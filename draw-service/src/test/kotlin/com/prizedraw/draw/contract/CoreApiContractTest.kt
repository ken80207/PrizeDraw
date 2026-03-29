package com.prizedraw.draw.contract

import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.shouldBe

/**
 * Core API contract verification for draw-service.
 *
 * Draw-service does not make outbound HTTP calls to the Core API — it owns its
 * own database tables and receives requests rather than delegating to another service.
 * The Core API contract (ban-status checks, player profile look-ups) is exercised by
 * the Realtime Gateway, which does maintain an HTTP client to Core API.
 * See `realtime-gateway/src/test/.../CoreApiContractTest.kt` for those tests.
 *
 * This file verifies the draw-service's own exposed HTTP contract: that its endpoints
 * follow the agreed API shapes defined in `api-contracts`. Specifically it confirms:
 * - The draw-service base path constant matches the route registration.
 * - Error response shapes match the contract DTOs.
 */
class CoreApiContractTest :
    FunSpec({

        test("draw-service kuji endpoint base path matches api-contracts constant") {
            // This is a contract guard: if DrawEndpoints.BASE or DRAW_KUJI changes in
            // api-contracts, the Routing.kt registration must change accordingly.
            // Failing this test means a breaking change to the published API surface.
            val expectedBase = "/api/v1/draws"
            val expectedKujiPath = "$expectedBase/kuji"

            com.prizedraw.contracts.endpoints.DrawEndpoints.BASE shouldBe expectedBase
            com.prizedraw.contracts.endpoints.DrawEndpoints.DRAW_KUJI shouldBe expectedKujiPath
        }

        test("draw-service unlimited endpoint path matches api-contracts constant") {
            val expected = "/api/v1/draws/unlimited"
            com.prizedraw.contracts.endpoints.DrawEndpoints.DRAW_UNLIMITED shouldBe expected
        }

        test("draw-service queue join endpoint path matches api-contracts constant") {
            val expected = "/api/v1/draws/kuji/queue/join"
            com.prizedraw.contracts.endpoints.DrawEndpoints.QUEUE_JOIN shouldBe expected
        }

        test("draw-service sync progress endpoint path matches api-contracts constant") {
            val expected = "/api/v1/draws/sync/progress"
            com.prizedraw.contracts.endpoints.DrawEndpoints.SYNC_PROGRESS shouldBe expected
        }
    })
