package com.prizedraw.realtime.contract

import com.prizedraw.realtime.infrastructure.client.CoreApiClient
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import java.util.UUID

/**
 * Contract tests for [CoreApiClient] — verifies how the client handles the range of
 * HTTP responses that the Core API can return for ban-status checks.
 *
 * All tests use the Ktor [MockEngine] so no real network or Core API process is needed.
 * The circuit breaker inside [CoreApiClient] uses Resilience4j in-process state;
 * each test constructs a fresh client to avoid breaker state leaking between cases.
 *
 * Test scenarios:
 * - 200 response with `"banned":true` → isPlayerBanned returns true.
 * - 200 response with `"banned":false` → isPlayerBanned returns false.
 * - 404 response → isPlayerBanned returns false (fail-open).
 * - 500 response → isPlayerBanned returns false (fail-open).
 * - Network exception (simulated by the mock engine throwing) → returns false (fail-open).
 * - Cached ban result is served without a second HTTP call within TTL.
 */
class CoreApiContractTest :
    FunSpec({

        val baseUrl = "http://localhost:9092"

        fun buildClient(
            statusCode: HttpStatusCode = HttpStatusCode.OK,
            responseBody: String = """{"banned":false}""",
        ): HttpClient =
            HttpClient(
                MockEngine { _ ->
                    respond(
                        content = responseBody,
                        status = statusCode,
                        headers = headersOf(HttpHeaders.ContentType, "application/json"),
                    )
                },
            )

        fun buildThrowingClient(cause: Throwable): HttpClient =
            HttpClient(
                MockEngine { _ -> throw cause },
            )

        test("returns true when Core API responds with banned:true") {
            val httpClient = buildClient(responseBody = """{"banned":true}""")
            val coreApiClient = CoreApiClient(httpClient, baseUrl)
            val playerId = UUID.randomUUID()

            val result = coreApiClient.isPlayerBanned(playerId)

            result shouldBe true
            httpClient.close()
        }

        test("returns false when Core API responds with banned:false") {
            val httpClient = buildClient(responseBody = """{"banned":false}""")
            val coreApiClient = CoreApiClient(httpClient, baseUrl)
            val playerId = UUID.randomUUID()

            val result = coreApiClient.isPlayerBanned(playerId)

            result shouldBe false
            httpClient.close()
        }

        test("returns false when Core API returns 404 (fail-open)") {
            val httpClient =
                buildClient(
                    statusCode = HttpStatusCode.NotFound,
                    responseBody = """{"error":"player not found"}""",
                )
            val coreApiClient = CoreApiClient(httpClient, baseUrl)
            val playerId = UUID.randomUUID()

            val result = coreApiClient.isPlayerBanned(playerId)

            result shouldBe false
            httpClient.close()
        }

        test("returns false when Core API returns 500 (fail-open)") {
            val httpClient =
                buildClient(
                    statusCode = HttpStatusCode.InternalServerError,
                    responseBody = """{"error":"internal server error"}""",
                )
            val coreApiClient = CoreApiClient(httpClient, baseUrl)
            val playerId = UUID.randomUUID()

            val result = coreApiClient.isPlayerBanned(playerId)

            result shouldBe false
            httpClient.close()
        }

        test("returns false when network call throws (fail-open circuit breaker)") {
            val httpClient = buildThrowingClient(java.io.IOException("connection refused"))
            val coreApiClient = CoreApiClient(httpClient, baseUrl)
            val playerId = UUID.randomUUID()

            val result = coreApiClient.isPlayerBanned(playerId)

            result shouldBe false
            httpClient.close()
        }

        test("cached ban result is served on subsequent calls without additional HTTP request") {
            var requestCount = 0
            val httpClient =
                HttpClient(
                    MockEngine { _ ->
                        requestCount++
                        respond(
                            content = """{"banned":true}""",
                            status = HttpStatusCode.OK,
                            headers = headersOf(HttpHeaders.ContentType, "application/json"),
                        )
                    },
                )
            val coreApiClient = CoreApiClient(httpClient, baseUrl)
            val playerId = UUID.randomUUID()

            // First call — hits the mock engine.
            val firstResult = coreApiClient.isPlayerBanned(playerId)
            // Second call — should hit the in-memory cache, not the engine.
            val secondResult = coreApiClient.isPlayerBanned(playerId)

            firstResult shouldBe true
            secondResult shouldBe true
            requestCount shouldBe 1 // only one real HTTP request was made

            httpClient.close()
        }
    })
