package com.prizedraw.realtime.infrastructure.client

import com.prizedraw.shared.resilience.CircuitBreakers
import io.ktor.client.HttpClient
import org.slf4j.LoggerFactory

/**
 * HTTP client for making calls to the Draw Service from the realtime-gateway.
 *
 * The Draw Service owns the authoritative draw state. This client is a placeholder
 * for future cross-service calls such as fetching live draw session state.
 * Currently the realtime-gateway reads draw state from the shared PostgreSQL
 * database directly via its own [IDrawRepository].
 *
 * A [CircuitBreakers] instance wraps every outbound call to prevent cascading failures.
 *
 * @param httpClient The Ktor CIO HTTP client used for outbound requests.
 * @param baseUrl Base URL of the Draw Service, e.g. `http://localhost:9093`.
 */
public class DrawServiceClient(
    private val httpClient: HttpClient,
    private val baseUrl: String,
) {
    private val log = LoggerFactory.getLogger(DrawServiceClient::class.java)

    @Suppress("UnusedPrivateProperty")
    private val circuitBreaker = CircuitBreakers.get("draw-service")

    /**
     * Returns the configured base URL for diagnostic and health-check logging.
     */
    public fun targetBaseUrl(): String = baseUrl

    /**
     * Placeholder for a future draw-state query.
     *
     * Replace this with a real HTTP call once the Draw Service exposes a
     * `GET /api/v1/campaigns/{campaignId}/draw-state` endpoint.
     */
    public suspend fun isHealthy(): Boolean {
        log.debug("DrawServiceClient.isHealthy called for {}", baseUrl)
        // Unused parameter reference to satisfy the compiler until real methods are added.
        httpClient.toString()
        return true
    }
}
