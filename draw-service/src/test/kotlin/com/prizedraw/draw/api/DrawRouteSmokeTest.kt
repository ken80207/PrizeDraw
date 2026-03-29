package com.prizedraw.draw.api

import com.prizedraw.contracts.endpoints.DrawEndpoints
import com.prizedraw.draw.application.ports.input.IDrawKujiUseCase
import com.prizedraw.draw.application.ports.input.IDrawUnlimitedUseCase
import com.prizedraw.draw.application.services.DrawSyncService
import com.prizedraw.draw.application.services.KujiQueueService
import com.prizedraw.draw.application.services.LiveDrawService
import com.prizedraw.draw.api.routes.drawRoutes
import com.prizedraw.draw.infrastructure.persistence.CampaignRepositoryImpl
import com.prizedraw.draw.infrastructure.persistence.TicketBoxRepositoryImpl
import com.prizedraw.draw.plugins.configureSecurity
import com.prizedraw.shared.auth.JwtVerifier
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe
import io.ktor.client.request.delete
import io.ktor.client.request.post
import io.ktor.client.request.setBody
import io.ktor.http.ContentType
import io.ktor.http.HttpStatusCode
import io.ktor.http.contentType
import io.ktor.server.application.install
import io.ktor.server.routing.routing
import io.ktor.server.testing.testApplication
import io.mockk.mockk
import org.koin.core.context.stopKoin
import org.koin.dsl.module
import org.koin.ktor.plugin.Koin
import org.koin.logger.slf4jLogger

/**
 * Route smoke tests for draw-service endpoints.
 *
 * These tests verify the route structure is registered and authentication is enforced.
 * Business logic is entirely mocked via Koin.
 *
 * All draw endpoints require a valid Bearer token (JWT player auth). Requests without
 * a token must receive 401 Unauthorized, confirming the [configureSecurity] guard fires.
 */
class DrawRouteSmokeTest : FunSpec({

    afterEach {
        // Stop the Koin context started by testApplication to avoid state leaking
        // between test cases when tests run in the same JVM.
        stopKoin()
    }

    /**
     * Builds the minimal Koin module needed to satisfy [drawRoutes] injection points.
     * All dependencies are relaxed mocks — no real DB, Redis, or business logic.
     */
    fun testKoinModule() =
        module {
            single { mockk<IDrawKujiUseCase>(relaxed = true) }
            single { mockk<IDrawUnlimitedUseCase>(relaxed = true) }
            single { mockk<KujiQueueService>(relaxed = true) }
            single { mockk<CampaignRepositoryImpl>(relaxed = true) }
            single { mockk<TicketBoxRepositoryImpl>(relaxed = true) }
            single { mockk<DrawSyncService>(relaxed = true) }
            single { mockk<LiveDrawService>(relaxed = true) }
            // JwtVerifier with a throwaway secret: used by configureSecurity to reject
            // tokens that are absent or invalid in these smoke-test requests.
            single { JwtVerifier(jwtSecret = "test-secret-that-is-at-least-32-chars-long!!", expectedIssuer = "prizedraw") }
        }

    test("POST draw kuji endpoint requires authentication") {
        testApplication {
            application {
                install(Koin) {
                    slf4jLogger()
                    modules(testKoinModule())
                }
                configureSecurity()
                routing { drawRoutes() }
            }
            val response = client.post(DrawEndpoints.DRAW_KUJI) {
                contentType(ContentType.Application.Json)
                setBody("{}")
            }
            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("POST draw unlimited endpoint requires authentication") {
        testApplication {
            application {
                install(Koin) {
                    slf4jLogger()
                    modules(testKoinModule())
                }
                configureSecurity()
                routing { drawRoutes() }
            }
            val response = client.post(DrawEndpoints.DRAW_UNLIMITED) {
                contentType(ContentType.Application.Json)
                setBody("{}")
            }
            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("POST queue join endpoint requires authentication") {
        testApplication {
            application {
                install(Koin) {
                    slf4jLogger()
                    modules(testKoinModule())
                }
                configureSecurity()
                routing { drawRoutes() }
            }
            val response = client.post(DrawEndpoints.QUEUE_JOIN) {
                contentType(ContentType.Application.Json)
                setBody("{}")
            }
            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("DELETE queue leave endpoint requires authentication") {
        testApplication {
            application {
                install(Koin) {
                    slf4jLogger()
                    modules(testKoinModule())
                }
                configureSecurity()
                routing { drawRoutes() }
            }
            val response = client.delete(DrawEndpoints.QUEUE_LEAVE) {
                contentType(ContentType.Application.Json)
                setBody("{}")
            }
            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }

    test("POST sync progress endpoint requires authentication") {
        testApplication {
            application {
                install(Koin) {
                    slf4jLogger()
                    modules(testKoinModule())
                }
                configureSecurity()
                routing { drawRoutes() }
            }
            val response = client.post(DrawEndpoints.SYNC_PROGRESS) {
                contentType(ContentType.Application.Json)
                setBody("{}")
            }
            response.status shouldBe HttpStatusCode.Unauthorized
        }
    }
})
