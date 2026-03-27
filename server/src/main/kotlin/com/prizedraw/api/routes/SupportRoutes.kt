@file:Suppress("MagicNumber")

package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.api.plugins.StaffPrincipal
import com.prizedraw.api.plugins.satisfies
import com.prizedraw.application.ports.input.support.ICloseSupportTicketUseCase
import com.prizedraw.application.ports.input.support.ICreateSupportTicketUseCase
import com.prizedraw.application.ports.input.support.IGetSupportTicketDetailUseCase
import com.prizedraw.application.ports.input.support.IReplySupportTicketUseCase
import com.prizedraw.application.ports.input.support.SupportTicketDetail
import com.prizedraw.application.ports.output.ISupportRepository
import com.prizedraw.application.usecases.support.SupportTicketNotFoundException
import com.prizedraw.application.usecases.support.TicketAlreadyClosedException
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.contracts.enums.SupportTicketCategory
import com.prizedraw.contracts.enums.SupportTicketStatus
import com.prizedraw.domain.entities.SupportTicket
import com.prizedraw.domain.entities.SupportTicketMessage
import com.prizedraw.infrastructure.external.line.LineSignatureVerifier
import com.prizedraw.infrastructure.external.line.LineWebhookAdapter
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receiveText
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.util.UUID

@Serializable
private data class CreateTicketRequest(
    val category: String,
    val subject: String,
    val body: String,
)

@Serializable
private data class ReplyTicketRequest(
    val body: String,
)

@Serializable
private data class CloseTicketRequest(
    val satisfactionScore: Short? = null,
)

private val lenientJson =
    Json {
        isLenient = true
        ignoreUnknownKeys = true
    }

/**
 * Registers player-facing and admin support ticket routes plus the LINE webhook endpoint.
 *
 * Player routes (authenticated as player):
 * - POST   /api/v1/support/tickets            — create ticket
 * - GET    /api/v1/support/tickets            — list my tickets
 * - GET    /api/v1/support/tickets/{id}       — ticket detail
 * - POST   /api/v1/support/tickets/{id}/reply — player reply
 *
 * Admin routes (authenticated as staff):
 * - GET    /api/v1/admin/support/tickets                   — list all (filterable by status/assignee)
 * - GET    /api/v1/admin/support/tickets/{id}              — detail with messages
 * - POST   /api/v1/admin/support/tickets/{id}/reply        — staff reply
 * - POST   /api/v1/admin/support/tickets/{id}/close        — close ticket
 *
 * Webhook:
 * - POST   /api/v1/webhooks/line             — LINE messaging webhook (HMAC-SHA256 verified)
 */
public fun Route.supportRoutes() {
    playerSupportRoutes()
    adminSupportRoutes()
}

private fun Route.playerSupportRoutes() {
    val createTicket: ICreateSupportTicketUseCase by inject()
    val replyTicket: IReplySupportTicketUseCase by inject()
    val getDetail: IGetSupportTicketDetailUseCase by inject()
    val supportRepository: ISupportRepository by inject()

    authenticate("player") {
        route("/api/v1/support/tickets") {
            post { handleCreateTicket(createTicket) }
            get { handleListPlayerTickets(supportRepository) }
            get("{id}") { handleGetPlayerTicketDetail(getDetail) }
            post("{id}/reply") { handlePlayerReply(replyTicket) }
        }
    }
}

private fun Route.adminSupportRoutes() {
    val replyTicket: IReplySupportTicketUseCase by inject()
    val closeTicket: ICloseSupportTicketUseCase by inject()
    val getDetail: IGetSupportTicketDetailUseCase by inject()
    val supportRepository: ISupportRepository by inject()

    authenticate("staff") {
        route("/api/v1/admin/support/tickets") {
            get { handleAdminListTickets(supportRepository) }
            get("{id}") { handleAdminGetTicketDetail(getDetail) }
            post("{id}/reply") { handleAdminReply(replyTicket) }
            post("{id}/close") { handleAdminCloseTicket(closeTicket) }
        }
    }
}

private suspend fun RoutingContext.handleCreateTicket(createTicket: ICreateSupportTicketUseCase) {
    val playerId =
        call.principal<PlayerPrincipal>()?.playerId
            ?: return call.respond(HttpStatusCode.Unauthorized)
    val req = lenientJson.decodeFromString<CreateTicketRequest>(call.receiveText())
    val category =
        runCatching { SupportTicketCategory.valueOf(req.category) }.getOrElse {
            return call.respond(
                HttpStatusCode.BadRequest,
                mapOf("error" to "Invalid category: ${req.category}"),
            )
        }
    runCatching {
        createTicket.execute(playerId, category, req.subject, req.body)
    }.fold(
        onSuccess = { call.respond(HttpStatusCode.Created, it.toResponseMap()) },
        onFailure = { e ->
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
        },
    )
}

private suspend fun RoutingContext.handleListPlayerTickets(supportRepository: ISupportRepository) {
    val playerId =
        call.principal<PlayerPrincipal>()?.playerId
            ?: return call.respond(HttpStatusCode.Unauthorized)
    val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
    val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: 20).coerceIn(1, 100)
    val tickets = supportRepository.findTicketsByPlayer(playerId, offset, limit)
    call.respond(HttpStatusCode.OK, tickets.map { it.toResponseMap() })
}

private suspend fun RoutingContext.handleGetPlayerTicketDetail(getDetail: IGetSupportTicketDetailUseCase) {
    val playerId =
        call.principal<PlayerPrincipal>()?.playerId
            ?: return call.respond(HttpStatusCode.Unauthorized)
    val ticketId = call.parseTicketId() ?: return
    val detail =
        getDetail.execute(ticketId)
            ?: return call.respond(HttpStatusCode.NotFound, mapOf("error" to "Ticket not found"))
    if (detail.ticket.playerId != playerId) {
        return call.respond(HttpStatusCode.Forbidden)
    }
    call.respond(HttpStatusCode.OK, detail.toResponseMap())
}

private suspend fun RoutingContext.handlePlayerReply(replyTicket: IReplySupportTicketUseCase) {
    val playerId =
        call.principal<PlayerPrincipal>()?.playerId
            ?: return call.respond(HttpStatusCode.Unauthorized)
    val ticketId = call.parseTicketId() ?: return
    val req = lenientJson.decodeFromString<ReplyTicketRequest>(call.receiveText())
    runCatching {
        replyTicket.execute(ticketId, playerId, null, req.body)
    }.fold(
        onSuccess = { call.respond(HttpStatusCode.Created, it.toResponseMap()) },
        onFailure = { e -> call.respondSupportError(e) },
    )
}

private suspend fun RoutingContext.handleAdminListTickets(supportRepository: ISupportRepository) {
    call.requireStaffMinimum(StaffRole.CUSTOMER_SERVICE) ?: return
    val filterStatus =
        call.request.queryParameters["status"]?.let {
            runCatching { SupportTicketStatus.valueOf(it) }.getOrNull()
        }
    val assigneeId =
        call.request.queryParameters["assignee"]?.let {
            runCatching { UUID.fromString(it) }.getOrNull()
        }
    val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
    val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: 20).coerceIn(1, 100)
    val tickets =
        supportRepository.findTicketsForQueue(
            status = filterStatus,
            priority = null,
            assignedToStaffId = assigneeId,
            offset = offset,
            limit = limit,
        )
    call.respond(HttpStatusCode.OK, tickets.map { it.toResponseMap() })
}

private suspend fun RoutingContext.handleAdminGetTicketDetail(getDetail: IGetSupportTicketDetailUseCase) {
    call.requireStaffMinimum(StaffRole.CUSTOMER_SERVICE) ?: return
    val ticketId = call.parseTicketId() ?: return
    val detail =
        getDetail.execute(ticketId)
            ?: return call.respond(HttpStatusCode.NotFound, mapOf("error" to "Ticket not found"))
    call.respond(HttpStatusCode.OK, detail.toResponseMap())
}

private suspend fun RoutingContext.handleAdminReply(replyTicket: IReplySupportTicketUseCase) {
    val staff = call.requireStaffMinimum(StaffRole.CUSTOMER_SERVICE) ?: return
    val ticketId = call.parseTicketId() ?: return
    val req = lenientJson.decodeFromString<ReplyTicketRequest>(call.receiveText())
    runCatching {
        replyTicket.execute(ticketId, null, staff.staffId, req.body)
    }.fold(
        onSuccess = { call.respond(HttpStatusCode.Created, it.toResponseMap()) },
        onFailure = { e -> call.respondSupportError(e) },
    )
}

private suspend fun RoutingContext.handleAdminCloseTicket(closeTicket: ICloseSupportTicketUseCase) {
    val staff = call.requireStaffMinimum(StaffRole.CUSTOMER_SERVICE) ?: return
    val ticketId = call.parseTicketId() ?: return
    val req = lenientJson.decodeFromString<CloseTicketRequest>(call.receiveText())
    runCatching {
        closeTicket.execute(ticketId, staff.staffId, req.satisfactionScore)
    }.fold(
        onSuccess = { call.respond(HttpStatusCode.OK, it.toResponseMap()) },
        onFailure = { e -> call.respondSupportError(e) },
    )
}

/** Registers the LINE webhook route (no auth — signature verified inline). */
public fun Route.lineWebhookRoute() {
    val lineWebhookAdapter: LineWebhookAdapter by inject()
    val lineSignatureVerifier: LineSignatureVerifier by inject()

    post("/api/v1/webhooks/line") {
        val signature = call.request.headers["X-Line-Signature"] ?: ""
        val bodyText = call.receiveText()
        val bodyBytes = bodyText.toByteArray(Charsets.UTF_8)
        if (!lineSignatureVerifier.verify(bodyBytes, signature)) {
            call.respond(HttpStatusCode.Unauthorized, mapOf("error" to "Invalid LINE signature"))
            return@post
        }
        lineWebhookAdapter.handleWebhook(bodyText)
        call.respond(HttpStatusCode.OK)
    }
}

// --- Private helpers ---

private suspend fun ApplicationCall.parseTicketId(): UUID? {
    val raw =
        parameters["id"] ?: run {
            respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing id"))
            return null
        }
    return runCatching { UUID.fromString(raw) }.getOrElse {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid ticket id"))
        null
    }
}

private suspend fun ApplicationCall.requireStaffMinimum(minimumRole: StaffRole): StaffPrincipal? {
    val staff = principal<StaffPrincipal>()
    if (staff == null) {
        respond(HttpStatusCode.Unauthorized, mapOf("error" to "Authentication required"))
        return null
    }
    if (!staff.role.satisfies(minimumRole)) {
        respond(
            HttpStatusCode.Forbidden,
            mapOf("error" to "Insufficient role: requires $minimumRole or above"),
        )
        return null
    }
    return staff
}

private suspend fun ApplicationCall.respondSupportError(e: Throwable) {
    when (e) {
        is SupportTicketNotFoundException ->
            respond(HttpStatusCode.NotFound, mapOf("error" to e.message))
        is TicketAlreadyClosedException ->
            respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to e.message))
        is IllegalArgumentException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to "Unexpected error"))
    }
}

private fun SupportTicket.toResponseMap(): Map<String, Any?> =
    mapOf(
        "id" to id.toString(),
        "playerId" to playerId.value.toString(),
        "assignedToStaffId" to assignedToStaffId?.toString(),
        "category" to category.name,
        "subject" to subject,
        "status" to status.name,
        "priority" to priority.name,
        "satisfactionScore" to satisfactionScore,
        "lineThreadId" to lineThreadId,
        "closedAt" to closedAt?.toString(),
        "createdAt" to createdAt.toString(),
        "updatedAt" to updatedAt.toString(),
    )

private fun SupportTicketMessage.toResponseMap(): Map<String, Any?> =
    mapOf(
        "id" to id.toString(),
        "supportTicketId" to supportTicketId.toString(),
        "authorPlayerId" to authorPlayerId?.value?.toString(),
        "authorStaffId" to authorStaffId?.toString(),
        "body" to body,
        "channel" to channel.name,
        "createdAt" to createdAt.toString(),
    )

private fun SupportTicketDetail.toResponseMap(): Map<String, Any?> =
    mapOf(
        "ticket" to ticket.toResponseMap(),
        "messages" to messages.map { it.toResponseMap() },
    )
