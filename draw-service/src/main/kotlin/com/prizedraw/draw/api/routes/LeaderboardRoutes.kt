package com.prizedraw.draw.api.routes

import com.prizedraw.contracts.dto.leaderboard.LeaderboardPeriod
import com.prizedraw.contracts.dto.leaderboard.LeaderboardType
import com.prizedraw.contracts.endpoints.LeaderboardEndpoints
import com.prizedraw.draw.application.ports.input.IGetLeaderboardUseCase
import com.prizedraw.draw.domain.valueobjects.CampaignId
import com.prizedraw.draw.domain.valueobjects.PlayerId
import com.prizedraw.draw.plugins.PlayerPrincipal
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.principal
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import org.koin.ktor.ext.inject
import java.util.UUID

/**
 * Registers leaderboard query routes.
 *
 * - GET [LeaderboardEndpoints.BASE]              — Query leaderboard by type + period.
 * - GET [LeaderboardEndpoints.CAMPAIGN_SPECIFIC] — Campaign-scoped leaderboard.
 *
 * Query parameters:
 * - `type`   [LeaderboardType]   (required for BASE endpoint)
 * - `period` [LeaderboardPeriod] (default ALL_TIME)
 * - `limit`  Int                 (default 100, max 500)
 */
public fun Route.leaderboardRoutes() {
    val getLeaderboardUseCase: IGetLeaderboardUseCase by inject()

    get(LeaderboardEndpoints.BASE) {
        val typeParam = call.request.queryParameters["type"]
        val type =
            typeParam?.let { runCatching { LeaderboardType.valueOf(it.uppercase()) }.getOrNull() }
                ?: run {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing or invalid 'type' parameter"))
                    return@get
                }

        val period = parsePeriod(call.request.queryParameters["period"])
        val limit =
            call.request.queryParameters["limit"]?.toIntOrNull() ?: IGetLeaderboardUseCase.DEFAULT_LIMIT

        val playerId = call.principal<PlayerPrincipal>()?.playerId?.let { PlayerId(it.value) }
        val result =
            getLeaderboardUseCase.execute(
                type = type,
                period = period,
                limit = limit,
                requestingPlayerId = playerId,
            )
        call.respond(HttpStatusCode.OK, result)
    }

    get(LeaderboardEndpoints.CAMPAIGN_SPECIFIC) {
        val rawCampaignId =
            call.parameters["campaignId"] ?: run {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing campaignId"))
                return@get
            }
        val campaignId =
            runCatching { CampaignId(UUID.fromString(rawCampaignId)) }.getOrElse {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid campaignId"))
                return@get
            }
        val period = parsePeriod(call.request.queryParameters["period"])
        val limit =
            call.request.queryParameters["limit"]?.toIntOrNull() ?: IGetLeaderboardUseCase.DEFAULT_LIMIT

        val playerId = call.principal<PlayerPrincipal>()?.playerId?.let { PlayerId(it.value) }
        val result =
            getLeaderboardUseCase.execute(
                type = LeaderboardType.CAMPAIGN_SPECIFIC,
                period = period,
                campaignId = campaignId,
                limit = limit,
                requestingPlayerId = playerId,
            )
        call.respond(HttpStatusCode.OK, result)
    }
}

private fun parsePeriod(raw: String?): LeaderboardPeriod =
    raw?.let { runCatching { LeaderboardPeriod.valueOf(it.uppercase()) }.getOrNull() }
        ?: LeaderboardPeriod.ALL_TIME
