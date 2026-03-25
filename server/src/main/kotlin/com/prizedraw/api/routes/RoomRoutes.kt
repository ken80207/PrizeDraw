package com.prizedraw.api.routes

import com.prizedraw.application.services.RoomScalingService
import com.prizedraw.contracts.dto.room.CampaignStatsDto
import com.prizedraw.contracts.dto.room.RoomInstanceDto
import com.prizedraw.contracts.endpoints.CampaignEndpoints
import com.prizedraw.domain.entities.RoomInstance
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import org.koin.ktor.ext.inject
import java.util.UUID

/**
 * Registers room-scaling query endpoints.
 *
 * - `GET /api/v1/campaigns/kuji/{campaignId}/rooms` — lists all active room shards
 *   with their current player counts. Clients use this to pick a shard before
 *   connecting to the sharded WebSocket endpoint.
 *
 * - `GET /api/v1/campaigns/kuji/{campaignId}/stats` — returns aggregated viewer
 *   stats across all active shards. Suitable for displaying a global "X 人在線"
 *   indicator without opening a WebSocket connection.
 */
public fun Route.roomRoutes() {
    val roomScalingService: RoomScalingService by inject()

    get(CampaignEndpoints.CAMPAIGN_ROOMS) {
        val campaignId = call.parseCampaignId() ?: return@get
        val rooms = roomScalingService.listActiveRooms(campaignId)
        call.respond(HttpStatusCode.OK, rooms.map { it.toDto() })
    }

    get(CampaignEndpoints.CAMPAIGN_STATS) {
        val campaignId = call.parseCampaignId() ?: return@get
        val stats = roomScalingService.getCampaignStats(campaignId)
        val rooms = roomScalingService.listActiveRooms(campaignId)
        call.respond(
            HttpStatusCode.OK,
            CampaignStatsDto(
                totalViewers = stats.totalViewers,
                activeRooms = stats.activeRooms,
                totalInQueue = stats.totalInQueue,
                rooms = rooms.map { it.toDto() },
            ),
        )
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.parseCampaignId(): UUID? {
    val raw = parameters["campaignId"] ?: run {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing campaignId"))
        return null
    }
    return runCatching { UUID.fromString(raw) }.getOrElse {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid campaignId"))
        null
    }
}

private fun RoomInstance.toDto(): RoomInstanceDto =
    RoomInstanceDto(
        id = id.toString(),
        instanceNumber = instanceNumber,
        playerCount = playerCount,
        maxPlayers = maxPlayers,
    )
