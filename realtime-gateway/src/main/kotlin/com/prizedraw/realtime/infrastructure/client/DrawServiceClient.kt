package com.prizedraw.realtime.infrastructure.client

import com.prizedraw.shared.resilience.CircuitBreakers
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import kotlinx.serialization.Serializable
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Response DTO for a campaign's current draw state, as returned by the Draw Service.
 *
 * @property campaignId The campaign this state belongs to.
 * @property isActive Whether the campaign is currently active.
 * @property totalDraws Total number of draws completed for this campaign.
 * @property remainingTickets Number of tickets still available.
 */
@Serializable
public data class DrawStateResponse(
    val campaignId: String,
    val isActive: Boolean,
    val totalDraws: Int,
    val remainingTickets: Int,
)

/**
 * Response DTO for the current queue status of a ticket box, as returned by the Draw Service.
 *
 * @property ticketBoxId The ticket box this status belongs to.
 * @property queueLength Current number of players waiting in the draw queue.
 * @property estimatedWaitSeconds Estimated seconds until the next draw slot becomes available.
 */
@Serializable
public data class QueueStatusResponse(
    val ticketBoxId: String,
    val queueLength: Int,
    val estimatedWaitSeconds: Int,
)

/**
 * HTTP client for making calls to the Draw Service from the realtime-gateway.
 *
 * The Draw Service is the authoritative owner of draw session state. This client fetches
 * draw-related data (campaign draw state, queue status) over HTTP rather than via a shared
 * database read, respecting the service boundary between the realtime-gateway and draw-service.
 *
 * Chat, feed, and room sharding state that belong to the realtime-gateway's own domain are
 * still read from the shared database directly via the corresponding repository implementations.
 * Future work — migrate any remaining draw-related direct DB reads in the gateway to use this client.
 *
 * A [CircuitBreakers] instance wraps every outbound call to prevent cascading failures if the
 * Draw Service is slow or unavailable. All methods fail-open (return `null`) when the circuit
 * breaker is open or the request fails.
 *
 * @param httpClient The Ktor CIO HTTP client used for outbound requests.
 * @param baseUrl Base URL of the Draw Service, e.g. `http://localhost:9093`.
 */
public class DrawServiceClient(
    private val httpClient: HttpClient,
    private val baseUrl: String,
) {
    private val log = LoggerFactory.getLogger(DrawServiceClient::class.java)
    private val circuitBreaker = CircuitBreakers.get("draw-service")

    /**
     * Returns the configured base URL for diagnostic and health-check logging.
     */
    public fun targetBaseUrl(): String = baseUrl

    /**
     * Fetches the current draw state for a campaign from the Draw Service.
     *
     * Returns `null` when the circuit breaker is open, the Draw Service is unavailable,
     * or the campaign is not found (fail-open semantics).
     *
     * @param campaignId The campaign whose draw state is requested.
     * @return The current [DrawStateResponse], or `null` on any failure.
     */
    public suspend fun getCampaignDrawState(campaignId: UUID): DrawStateResponse? {
        if (!circuitBreaker.tryAcquirePermission()) {
            log.debug("Circuit breaker open — skipping draw state fetch for campaign {}", campaignId)
            return null
        }

        return runCatching {
            val response =
                httpClient
                    .get("$baseUrl/api/v1/draws/state/$campaignId")
                    .body<DrawStateResponse>()
            circuitBreaker.onSuccess(0, java.util.concurrent.TimeUnit.NANOSECONDS)
            response
        }.onFailure { err ->
            circuitBreaker.onError(0, java.util.concurrent.TimeUnit.NANOSECONDS, err)
            log.warn("DrawServiceClient draw state fetch failed for campaign {}: {}", campaignId, err.message)
        }.getOrNull()
    }

    /**
     * Fetches the current queue status for a ticket box from the Draw Service.
     *
     * Returns `null` when the circuit breaker is open, the Draw Service is unavailable,
     * or the ticket box is not found (fail-open semantics).
     *
     * @param ticketBoxId The ticket box whose queue status is requested.
     * @return The current [QueueStatusResponse], or `null` on any failure.
     */
    public suspend fun getQueueStatus(ticketBoxId: UUID): QueueStatusResponse? {
        if (!circuitBreaker.tryAcquirePermission()) {
            log.debug("Circuit breaker open — skipping queue status fetch for ticketBox {}", ticketBoxId)
            return null
        }

        return runCatching {
            val response =
                httpClient
                    .get("$baseUrl/api/v1/draws/queue/$ticketBoxId/status")
                    .body<QueueStatusResponse>()
            circuitBreaker.onSuccess(0, java.util.concurrent.TimeUnit.NANOSECONDS)
            response
        }.onFailure { err ->
            circuitBreaker.onError(0, java.util.concurrent.TimeUnit.NANOSECONDS, err)
            log.warn("DrawServiceClient queue status fetch failed for ticketBox {}: {}", ticketBoxId, err.message)
        }.getOrNull()
    }
}
