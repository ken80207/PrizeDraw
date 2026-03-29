package com.prizedraw.shared.plugins

import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.response.respondText
import io.ktor.server.routing.get
import io.ktor.server.routing.routing
import org.slf4j.LoggerFactory

private val log = LoggerFactory.getLogger("com.prizedraw.shared.plugins.HealthCheck")

/** Default [ReadinessCheck] that always signals ready. Used when no check is wired. */
private val alwaysReady: ReadinessCheck = ReadinessCheck { true }

/**
 * Health-check readiness predicate.
 *
 * Implement this interface and pass it to [configureHealthCheck] to control whether
 * the `/ready` endpoint reports the service as ready to accept traffic.
 * Common implementations check database connectivity and Redis availability.
 */
public fun interface ReadinessCheck {
    /**
     * Returns `true` when all dependencies this service requires are available.
     *
     * This function is invoked on every `/ready` probe, so it should be fast
     * (target < 50 ms). Throw or return `false` to signal not-ready.
     */
    public suspend fun isReady(): Boolean
}

/**
 * Installs `/health` and `/ready` endpoints on the Ktor [Application].
 *
 * - `GET /health` — always returns `200 OK` with body `{"status":"UP"}`.
 *   Kubernetes liveness probes should target this endpoint.
 *
 * - `GET /ready` — invokes [readinessCheck] and returns:
 *   - `200 OK` with body `{"status":"READY"}` when the check passes.
 *   - `503 Service Unavailable` with body `{"status":"NOT_READY"}` when it fails.
 *   Kubernetes readiness probes should target this endpoint.
 *
 * @param readinessCheck Optional predicate that gates the `/ready` response.
 *   Defaults to always-ready if omitted.
 */
public fun Application.configureHealthCheck(readinessCheck: ReadinessCheck = alwaysReady) {
    routing {
        get("/health") {
            call.respondJson(HttpStatusCode.OK, """{"status":"UP"}""")
        }

        get("/ready") {
            val ready =
                runCatching { readinessCheck.isReady() }
                    .onFailure { log.warn("Readiness check threw an exception", it) }
                    .getOrDefault(false)

            if (ready) {
                call.respondJson(HttpStatusCode.OK, """{"status":"READY"}""")
            } else {
                call.respondJson(HttpStatusCode.ServiceUnavailable, """{"status":"NOT_READY"}""")
            }
        }
    }
}

private suspend fun ApplicationCall.respondJson(
    status: HttpStatusCode,
    body: String,
) {
    respondText(
        text = body,
        contentType = ContentType.Application.Json,
        status = status,
    )
}
