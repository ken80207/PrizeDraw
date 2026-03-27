package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.contracts.endpoints.AdminEndpoints
import com.prizedraw.contracts.enums.StaffRole
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import kotlinx.serialization.Serializable

/**
 * Admin routes for leaderboard configuration.
 *
 * All routes require `authenticate("staff")` in the parent scope.
 *
 * - GET  [AdminEndpoints.LEADERBOARD_CONFIG] — Return current leaderboard type configurations
 * - PATCH [AdminEndpoints.LEADERBOARD_CONFIG] — Update leaderboard configurations (accepted, no-op)
 *
 * Configuration is currently static defaults. Persistence layer to be wired when a
 * dedicated `leaderboard_configs` table is added.
 */
public fun Route.adminLeaderboardConfigRoutes() {
    get(AdminEndpoints.LEADERBOARD_CONFIG) {
        call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@get
        call.respond(HttpStatusCode.OK, defaultLeaderboardConfigs())
    }

    patch(AdminEndpoints.LEADERBOARD_CONFIG) {
        call.requireStaffWithRole(StaffRole.ADMIN) ?: return@patch
        // Config persistence is not yet wired to a DB table; accept the request silently.
        call.respond(HttpStatusCode.OK, defaultLeaderboardConfigs())
    }
}

@Serializable
private data class LeaderboardConfigResponse(
    val id: String,
    val type: String,
    val name: String,
    val description: String,
    val enabled: Boolean,
    val displayLimit: Int,
)

private fun defaultLeaderboardConfigs(): List<LeaderboardConfigResponse> =
    listOf(
        LeaderboardConfigResponse(
            id = "draw-count",
            type = "DRAW_COUNT",
            name = "抽獎達人",
            description = "累計抽獎次數排行",
            enabled = true,
            displayLimit = 100,
        ),
        LeaderboardConfigResponse(
            id = "lucky-star",
            type = "LUCKY_STAR",
            name = "幸運之星",
            description = "高稀有度獎品獲得排行",
            enabled = true,
            displayLimit = 100,
        ),
        LeaderboardConfigResponse(
            id = "trade-volume",
            type = "TRADE_VOLUME",
            name = "交易風雲",
            description = "累計交易金額排行",
            enabled = true,
            displayLimit = 100,
        ),
    )
