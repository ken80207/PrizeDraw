package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.services.BroadcastService
import com.prizedraw.contracts.dto.broadcast.ActiveBroadcastsResponse
import com.prizedraw.contracts.dto.broadcast.BroadcastSessionDto
import com.prizedraw.contracts.dto.broadcast.StartBroadcastRequest
import com.prizedraw.contracts.dto.broadcast.StopBroadcastRequest
import com.prizedraw.contracts.endpoints.BroadcastEndpoints
import com.prizedraw.domain.entities.BroadcastSession
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import org.koin.ktor.ext.inject
import java.util.UUID

/**
 * Registers REST routes for the broadcast session subsystem.
 *
 * - POST [BroadcastEndpoints.START]  — start a live broadcast (authenticated).
 * - POST [BroadcastEndpoints.STOP]   — stop the caller's active broadcast (authenticated).
 * - GET  [BroadcastEndpoints.ACTIVE] — list active broadcasts for a campaign (public).
 */
public fun Route.broadcastRoutes() {
    val broadcastService: BroadcastService by inject()

    get(BroadcastEndpoints.ACTIVE) {
        val campaignIdStr =
            call.request.queryParameters["campaignId"] ?: run {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing campaignId parameter"))
                return@get
            }
        val campaignId =
            runCatching { UUID.fromString(campaignIdStr) }.getOrElse {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid campaignId"))
                return@get
            }
        val sessions = broadcastService.getActiveBroadcasts(campaignId)
        val response =
            ActiveBroadcastsResponse(
                campaignId = campaignIdStr,
                sessions = sessions.map { it.toDto() },
            )
        call.respond(HttpStatusCode.OK, response)
    }

    authenticate("player") {
        post(BroadcastEndpoints.START) {
            val principal = call.principal<PlayerPrincipal>()!!
            val request = call.receive<StartBroadcastRequest>()
            val campaignId =
                runCatching { UUID.fromString(request.campaignId) }.getOrElse {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid campaignId"))
                    return@post
                }
            val session = broadcastService.startBroadcast(campaignId, principal.playerId.value)
            call.respond(HttpStatusCode.Created, session.toDto())
        }

        post(BroadcastEndpoints.STOP) {
            val principal = call.principal<PlayerPrincipal>()!!
            val request = call.receive<StopBroadcastRequest>()
            val sessionId =
                runCatching { UUID.fromString(request.sessionId) }.getOrElse {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid sessionId"))
                    return@post
                }
            broadcastService.endBroadcast(sessionId)
            call.respond(HttpStatusCode.NoContent)
        }
    }
}

private fun BroadcastSession.toDto(): BroadcastSessionDto =
    BroadcastSessionDto(
        id = id.toString(),
        campaignId = campaignId.toString(),
        playerId = playerId.toString(),
        isActive = isActive,
        viewerCount = viewerCount,
        startedAt = startedAt,
        endedAt = endedAt,
    )
