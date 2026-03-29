package com.prizedraw.realtime.infrastructure.client

import com.prizedraw.shared.resilience.CircuitBreakers
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.isSuccess
import org.slf4j.LoggerFactory
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * HTTP client for making non-auth calls to the Core API from the realtime-gateway.
 *
 * Authentication is handled locally via [com.prizedraw.shared.auth.JwtVerifier] — this client
 * is only used for live database checks that cannot be resolved from the JWT alone, such as
 * ban status.
 *
 * Results are cached aggressively (default TTL: [BAN_CACHE_TTL_MS]) to minimise the number of
 * outbound HTTP calls during WebSocket connect storms.
 *
 * A circuit breaker wraps every call so a slow or failing Core API does not cascade into
 * WebSocket connection failures.
 *
 * @param httpClient The Ktor CIO HTTP client used for outbound requests.
 * @param baseUrl Base URL of the Core API, e.g. `http://localhost:9092`.
 */
public class CoreApiClient(
    private val httpClient: HttpClient,
    private val baseUrl: String,
) {
    private val log = LoggerFactory.getLogger(CoreApiClient::class.java)
    private val circuitBreaker = CircuitBreakers.get("core-api")

    /**
     * Cache entry: (isBanned, expiresAtMs).
     *
     * The simple pair avoids pulling in a cache library while keeping the implementation
     * easy to reason about.
     */
    private data class BanCacheEntry(
        val isBanned: Boolean,
        val expiresAtMs: Long,
    )

    private val banCache = ConcurrentHashMap<UUID, BanCacheEntry>()

    /**
     * Returns `true` when [playerId] is currently banned, `false` otherwise.
     *
     * Results are cached for [BAN_CACHE_TTL_MS] milliseconds. On circuit-breaker open
     * or HTTP error the method returns `false` (fail-open) to avoid blocking legitimate
     * players due to transient Core API outages.
     *
     * @param playerId The player to check.
     * @return `true` if the player is banned according to the Core API.
     */
    public suspend fun isPlayerBanned(playerId: UUID): Boolean {
        val now = System.currentTimeMillis()
        banCache[playerId]?.let { entry ->
            if (entry.expiresAtMs > now) {
                return entry.isBanned
            }
        }

        if (!circuitBreaker.tryAcquirePermission()) {
            log.debug("Circuit breaker open — skipping ban check for player {}", playerId)
            return false // fail-open on circuit-breaker open
        }

        return runCatching {
            val banned = fetchBanStatus(playerId)
            circuitBreaker.onSuccess(0, java.util.concurrent.TimeUnit.NANOSECONDS)
            banCache[playerId] = BanCacheEntry(isBanned = banned, expiresAtMs = now + BAN_CACHE_TTL_MS)
            banned
        }.onFailure { err ->
            circuitBreaker.onError(0, java.util.concurrent.TimeUnit.NANOSECONDS, err)
            log.warn("CoreApiClient ban check failed for player {}: {}", playerId, err.message)
        }.getOrDefault(false) // fail-open
    }

    @Suppress("TooGenericExceptionCaught")
    private suspend fun fetchBanStatus(playerId: UUID): Boolean =
        try {
            val response = httpClient.get("$baseUrl/api/v1/admin/players/$playerId/ban-status")
            if (response.status.isSuccess()) {
                val body = response.bodyAsText()
                body.contains("\"banned\":true")
            } else {
                false
            }
        } catch (e: Exception) {
            log.debug("Ban status fetch failed for player {}: {}", playerId, e.message)
            throw e
        }

    private companion object {
        /** Ban check result cache TTL: 60 seconds. */
        val BAN_CACHE_TTL_MS: Long = TimeUnit.SECONDS.toMillis(60)
    }
}
