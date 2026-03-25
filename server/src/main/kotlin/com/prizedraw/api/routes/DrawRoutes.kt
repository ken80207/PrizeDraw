package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.input.draw.IDrawKujiUseCase
import com.prizedraw.application.ports.input.draw.IDrawUnlimitedUseCase
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.application.services.DrawSyncService
import com.prizedraw.application.services.KujiQueueService
import com.prizedraw.application.services.QueueOperationException
import com.prizedraw.application.usecases.draw.InsufficientPointsException
import com.prizedraw.application.usecases.draw.NotSessionHolderException
import com.prizedraw.application.usecases.draw.TicketBoxNotFoundException
import com.prizedraw.application.usecases.draw.UnlimitedCampaignNotFoundException
import com.prizedraw.application.usecases.draw.UnlimitedRateLimitExceededException
import com.prizedraw.contracts.dto.draw.DrawKujiRequest
import com.prizedraw.contracts.dto.draw.DrawProgressRequest
import com.prizedraw.contracts.dto.draw.DrawSyncCancelRequest
import com.prizedraw.contracts.dto.draw.DrawSyncCompleteRequest
import com.prizedraw.contracts.dto.draw.DrawUnlimitedRequest
import com.prizedraw.contracts.dto.draw.JoinQueueRequest
import com.prizedraw.contracts.dto.draw.LeaveQueueRequest
import com.prizedraw.contracts.dto.draw.QueueEntryDto
import com.prizedraw.contracts.dto.draw.SwitchBoxRequest
import com.prizedraw.contracts.endpoints.DrawEndpoints
import com.prizedraw.domain.entities.QueueEntry
import com.prizedraw.domain.services.DrawValidationException
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.post
import org.koin.ktor.ext.inject
import java.util.UUID

/** Default draw session duration when the campaign or box cannot be resolved. */
private const val DEFAULT_SESSION_SECONDS = 120

/**
 * Registers kuji draw, queue management, and unlimited draw routes.
 *
 * All routes require JWT authentication (`player` scheme) and phone verification.
 *
 * - POST   [DrawEndpoints.DRAW_KUJI]         -- Execute a kuji draw (single or multi).
 * - POST   [DrawEndpoints.DRAW_UNLIMITED]    -- Execute a probability-based unlimited draw.
 * - POST   [DrawEndpoints.QUEUE_JOIN]         -- Join the draw queue for a ticket box.
 * - DELETE [DrawEndpoints.QUEUE_LEAVE]        -- Leave the draw queue.
 * - POST   [DrawEndpoints.QUEUE_SWITCH_BOX]   -- Atomically switch to a different box queue.
 */
public fun Route.drawRoutes() {
    val drawKujiUseCase: IDrawKujiUseCase by inject()
    val drawUnlimitedUseCase: IDrawUnlimitedUseCase by inject()
    val kujiQueueService: KujiQueueService by inject()
    val campaignRepository: ICampaignRepository by inject()
    val ticketBoxRepository: ITicketBoxRepository by inject()
    val drawSyncService: DrawSyncService by inject()

    authenticate("player") {
        post(DrawEndpoints.DRAW_KUJI) {
            handleDrawKuji(drawKujiUseCase)
        }

        post(DrawEndpoints.DRAW_UNLIMITED) {
            handleDrawUnlimited(drawUnlimitedUseCase)
        }

        post(DrawEndpoints.QUEUE_JOIN) {
            handleQueueJoin(kujiQueueService, campaignRepository, ticketBoxRepository)
        }

        delete(DrawEndpoints.QUEUE_LEAVE) {
            handleQueueLeave(kujiQueueService, campaignRepository, ticketBoxRepository)
        }

        post(DrawEndpoints.QUEUE_SWITCH_BOX) {
            handleQueueSwitchBox(kujiQueueService, campaignRepository, ticketBoxRepository)
        }

        post(DrawEndpoints.SYNC_PROGRESS) {
            handleSyncProgress(drawSyncService)
        }

        post(DrawEndpoints.SYNC_CANCEL) {
            handleSyncCancel(drawSyncService)
        }

        post(DrawEndpoints.SYNC_COMPLETE) {
            handleSyncComplete(drawSyncService)
        }
    }
}

private suspend fun io.ktor.server.routing.RoutingContext.handleDrawUnlimited(
    drawUnlimitedUseCase: IDrawUnlimitedUseCase,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val request = call.receive<DrawUnlimitedRequest>()
    val campaignId =
        runCatching { UUID.fromString(request.campaignId) }.getOrElse {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid campaignId"))
            return
        }
    val couponId =
        request.playerCouponId?.let {
            runCatching { UUID.fromString(it) }.getOrElse {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid playerCouponId"))
                return
            }
        }
    val result = runCatching { drawUnlimitedUseCase.execute(principal.playerId, campaignId, couponId) }
    result.fold(
        onSuccess = { call.respond(HttpStatusCode.OK, it) },
        onFailure = { ex -> call.handleUnlimitedDrawError(ex) },
    )
}

private suspend fun io.ktor.server.routing.RoutingContext.handleDrawKuji(drawKujiUseCase: IDrawKujiUseCase) {
    val principal = call.principal<PlayerPrincipal>()!!
    val playerId = principal.playerId
    val request = call.receive<DrawKujiRequest>()
    val boxId =
        runCatching { UUID.fromString(request.ticketBoxId) }.getOrElse {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid ticketBoxId"))
            return
        }
    val ticketIds =
        request.ticketIds.mapNotNull {
            runCatching { UUID.fromString(it) }.getOrNull()
        }
    val result =
        runCatching {
            drawKujiUseCase.execute(playerId, boxId, ticketIds, request.quantity)
        }
    result.fold(
        onSuccess = { call.respond(HttpStatusCode.OK, it) },
        onFailure = { ex -> call.handleDrawError(ex) },
    )
}

private suspend fun io.ktor.server.routing.RoutingContext.handleQueueJoin(
    kujiQueueService: KujiQueueService,
    campaignRepository: ICampaignRepository,
    ticketBoxRepository: ITicketBoxRepository,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val request = call.receive<JoinQueueRequest>()
    val boxId =
        runCatching { UUID.fromString(request.ticketBoxId) }.getOrElse {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid ticketBoxId"))
            return
        }
    val sessionSeconds = resolveSessionSeconds(campaignRepository, ticketBoxRepository, boxId)
    val entry =
        runCatching {
            kujiQueueService.joinQueue(principal.playerId, boxId, sessionSeconds)
        }
    entry.fold(
        onSuccess = { call.respond(HttpStatusCode.Created, it.toDto(0)) },
        onFailure = { ex -> call.handleQueueError(ex) },
    )
}

private suspend fun io.ktor.server.routing.RoutingContext.handleQueueLeave(
    kujiQueueService: KujiQueueService,
    campaignRepository: ICampaignRepository,
    ticketBoxRepository: ITicketBoxRepository,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val request = call.receive<LeaveQueueRequest>()
    val boxId =
        runCatching { UUID.fromString(request.ticketBoxId) }.getOrElse {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid ticketBoxId"))
            return
        }
    val sessionSeconds = resolveSessionSeconds(campaignRepository, ticketBoxRepository, boxId)
    kujiQueueService.leaveQueue(principal.playerId, boxId, sessionSeconds)
    call.respond(HttpStatusCode.NoContent)
}

private suspend fun io.ktor.server.routing.RoutingContext.handleQueueSwitchBox(
    kujiQueueService: KujiQueueService,
    campaignRepository: ICampaignRepository,
    ticketBoxRepository: ITicketBoxRepository,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val request = call.receive<SwitchBoxRequest>()
    val fromId =
        runCatching { UUID.fromString(request.fromBoxId) }.getOrElse {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid fromBoxId"))
            return
        }
    val toId =
        runCatching { UUID.fromString(request.toBoxId) }.getOrElse {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid toBoxId"))
            return
        }
    val sessionSeconds = resolveSessionSeconds(campaignRepository, ticketBoxRepository, toId)
    val entry =
        runCatching {
            kujiQueueService.switchBox(principal.playerId, fromId, toId, sessionSeconds)
        }
    entry.fold(
        onSuccess = { call.respond(HttpStatusCode.OK, it.toDto(0)) },
        onFailure = { ex -> call.handleQueueError(ex) },
    )
}

private suspend fun ApplicationCall.handleDrawError(ex: Throwable) {
    when (ex) {
        is NotSessionHolderException ->
            respond(HttpStatusCode.Forbidden, mapOf("error" to ex.message))
        is DrawValidationException ->
            respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to ex.message))
        is TicketBoxNotFoundException ->
            respond(HttpStatusCode.NotFound, mapOf("error" to ex.message))
        is InsufficientPointsException ->
            respond(HttpStatusCode.PaymentRequired, mapOf("error" to ex.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to ex.message))
    }
}

private suspend fun ApplicationCall.handleUnlimitedDrawError(ex: Throwable) {
    when (ex) {
        is UnlimitedRateLimitExceededException ->
            respond(HttpStatusCode.TooManyRequests, mapOf("error" to ex.message))
        is UnlimitedCampaignNotFoundException ->
            respond(HttpStatusCode.NotFound, mapOf("error" to ex.message))
        is InsufficientPointsException ->
            respond(HttpStatusCode.PaymentRequired, mapOf("error" to ex.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to ex.message))
    }
}

private suspend fun ApplicationCall.handleQueueError(ex: Throwable) {
    when (ex) {
        is QueueOperationException ->
            respond(HttpStatusCode.Conflict, mapOf("error" to ex.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to ex.message))
    }
}

private suspend fun resolveSessionSeconds(
    campaignRepository: ICampaignRepository,
    ticketBoxRepository: ITicketBoxRepository,
    boxId: UUID,
): Int {
    val box = ticketBoxRepository.findById(boxId) ?: return DEFAULT_SESSION_SECONDS
    val campaign = campaignRepository.findKujiById(box.kujiCampaignId) ?: return DEFAULT_SESSION_SECONDS
    return campaign.drawSessionSeconds
}

private fun QueueEntry.toDto(queueLength: Int): QueueEntryDto =
    QueueEntryDto(
        id = id.toString(),
        queueId = queueId.toString(),
        playerId = playerId.value.toString(),
        position = position,
        status = status,
        joinedAt = joinedAt,
        activatedAt = activatedAt,
        completedAt = completedAt,
        queueLength = queueLength,
        sessionExpiresAt = null,
    )

// --- Draw sync handlers ---

private suspend fun io.ktor.server.routing.RoutingContext.handleSyncProgress(drawSyncService: DrawSyncService) {
    val request = call.receive<DrawProgressRequest>()
    val sessionId =
        runCatching { UUID.fromString(request.sessionId) }.getOrElse {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid sessionId"))
            return
        }
    runCatching { drawSyncService.relayProgress(sessionId, request.progress) }
        .fold(
            onSuccess = { call.respond(HttpStatusCode.NoContent) },
            onFailure = { call.respond(HttpStatusCode.InternalServerError, mapOf("error" to it.message)) },
        )
}

private suspend fun io.ktor.server.routing.RoutingContext.handleSyncCancel(drawSyncService: DrawSyncService) {
    val request = call.receive<DrawSyncCancelRequest>()
    val sessionId =
        runCatching { UUID.fromString(request.sessionId) }.getOrElse {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid sessionId"))
            return
        }
    runCatching { drawSyncService.cancelDraw(sessionId) }
        .fold(
            onSuccess = { call.respond(HttpStatusCode.NoContent) },
            onFailure = { call.respond(HttpStatusCode.InternalServerError, mapOf("error" to it.message)) },
        )
}

private suspend fun io.ktor.server.routing.RoutingContext.handleSyncComplete(drawSyncService: DrawSyncService) {
    val request = call.receive<DrawSyncCompleteRequest>()
    val sessionId =
        runCatching { UUID.fromString(request.sessionId) }.getOrElse {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid sessionId"))
            return
        }
    val result = runCatching { drawSyncService.completeDraw(sessionId) }
    result.fold(
        onSuccess = { call.respond(HttpStatusCode.NoContent) },
        onFailure = { ex ->
            when (ex) {
                is IllegalStateException ->
                    call.respond(HttpStatusCode.Conflict, mapOf("error" to ex.message))
                else ->
                    call.respond(HttpStatusCode.InternalServerError, mapOf("error" to ex.message))
            }
        },
    )
}
