package com.prizedraw.notification

import com.prizedraw.shared.plugins.ReadinessCheck
import com.prizedraw.shared.plugins.configureHealthCheck
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.request.get
import io.ktor.http.HttpStatusCode
import io.ktor.server.testing.testApplication

/**
 * Readiness and liveness probe tests for the notification-worker health endpoints.
 *
 * Uses [testApplication] with [configureHealthCheck] from the shared module.
 * No database or Redis connection is required: the [ReadinessCheck] predicate
 * is supplied as a lambda so both pass and fail paths can be exercised inline.
 *
 * Test scenarios:
 * - GET /health always returns 200 OK regardless of dependency state.
 * - GET /ready returns 503 when the readiness check returns false.
 * - GET /ready returns 200 when the readiness check returns true.
 * - GET /ready returns 503 when the readiness check throws an exception.
 */
class ReadinessTest :
    FunSpec({

        test("health endpoint returns 200") {
            testApplication {
                application { configureHealthCheck() }
                val response = client.get("/health")
                response.status shouldBe HttpStatusCode.OK
            }
        }

        test("ready endpoint returns 503 when check returns false") {
            testApplication {
                application { configureHealthCheck(ReadinessCheck { false }) }
                val response = client.get("/ready")
                response.status shouldBe HttpStatusCode.ServiceUnavailable
            }
        }

        test("ready endpoint returns 200 when check passes") {
            testApplication {
                application { configureHealthCheck(ReadinessCheck { true }) }
                val response = client.get("/ready")
                response.status shouldBe HttpStatusCode.OK
            }
        }

        test("ready endpoint returns 503 when check throws") {
            testApplication {
                application {
                    configureHealthCheck(ReadinessCheck { error("DB connection refused") })
                }
                val response = client.get("/ready")
                response.status shouldBe HttpStatusCode.ServiceUnavailable
            }
        }
    })
