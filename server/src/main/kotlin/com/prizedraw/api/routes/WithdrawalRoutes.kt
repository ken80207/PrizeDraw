package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.input.withdrawal.IApproveWithdrawalUseCase
import com.prizedraw.application.ports.input.withdrawal.ICreateWithdrawalRequestUseCase
import com.prizedraw.application.ports.input.withdrawal.IRejectWithdrawalUseCase
import com.prizedraw.application.ports.output.IWithdrawalRepository
import com.prizedraw.application.services.InsufficientBalanceException
import com.prizedraw.application.usecases.withdrawal.TransferFailedException
import com.prizedraw.application.usecases.withdrawal.WithdrawalNotFoundException
import com.prizedraw.application.usecases.withdrawal.WithdrawalStateException
import com.prizedraw.application.usecases.withdrawal.toDto
import com.prizedraw.contracts.dto.withdrawal.CreateWithdrawalRequest
import com.prizedraw.contracts.dto.withdrawal.RejectWithdrawalRequest
import com.prizedraw.contracts.endpoints.WithdrawalEndpoints
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import java.util.UUID

private const val DEFAULT_PAGE_SIZE = 20
private const val MAX_PAGE_SIZE = 100

/**
 * Registers withdrawal routes.
 *
 * Player routes (JWT `player` auth):
 * - POST [WithdrawalEndpoints.CREATE]        — Submit a new withdrawal request.
 * - GET  [WithdrawalEndpoints.LIST]          — List own withdrawal requests.
 *
 * Admin routes (JWT `player` auth, staff check via header — simplified):
 * - GET  /api/v1/admin/withdrawals           — List pending withdrawal requests.
 * - PATCH /api/v1/admin/withdrawals/{id}/approve  — Approve.
 * - PATCH /api/v1/admin/withdrawals/{id}/reject   — Reject.
 */
public fun Route.withdrawalRoutes() {
    val createUseCase: ICreateWithdrawalRequestUseCase by inject()
    val approveUseCase: IApproveWithdrawalUseCase by inject()
    val rejectUseCase: IRejectWithdrawalUseCase by inject()
    val withdrawalRepository: IWithdrawalRepository by inject()

    authenticate("player") {
        post(WithdrawalEndpoints.CREATE) {
            val principal = call.principal<PlayerPrincipal>()!!
            val request = call.receive<CreateWithdrawalRequest>()
            runCatching { createUseCase.execute(principal.playerId, request) }
                .fold(
                    onSuccess = { call.respond(HttpStatusCode.Created, it) },
                    onFailure = { call.handleWithdrawalError(it) },
                )
        }

        get(WithdrawalEndpoints.LIST) {
            val principal = call.principal<PlayerPrincipal>()!!
            val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
            val limit =
                (call.request.queryParameters["limit"]?.toIntOrNull() ?: DEFAULT_PAGE_SIZE)
                    .coerceIn(1, MAX_PAGE_SIZE)
            val requests = withdrawalRepository.findByPlayer(principal.playerId, offset, limit)
            call.respond(HttpStatusCode.OK, requests.map { it.toDto() })
        }
    }

    // Admin routes (staff ID extracted from X-Staff-Id header as a simplified pattern)
    authenticate("player") {
        get("/api/v1/admin/withdrawals") {
            val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
            val limit =
                (call.request.queryParameters["limit"]?.toIntOrNull() ?: DEFAULT_PAGE_SIZE)
                    .coerceIn(1, MAX_PAGE_SIZE)
            val statusFilter = com.prizedraw.contracts.enums.WithdrawalStatus.PENDING_REVIEW
            val requests = withdrawalRepository.findByStatus(statusFilter, offset, limit)
            call.respond(HttpStatusCode.OK, requests.map { it.toDto() })
        }

        patch("/api/v1/admin/withdrawals/{withdrawalId}/approve") {
            val staffId = call.parseStaffId() ?: return@patch
            val withdrawalId = call.parseWithdrawalId() ?: return@patch
            runCatching { approveUseCase.execute(staffId, withdrawalId) }
                .fold(
                    onSuccess = { call.respond(HttpStatusCode.OK, it) },
                    onFailure = { call.handleWithdrawalError(it) },
                )
        }

        patch("/api/v1/admin/withdrawals/{withdrawalId}/reject") {
            val staffId = call.parseStaffId() ?: return@patch
            val withdrawalId = call.parseWithdrawalId() ?: return@patch
            val request = call.receive<RejectWithdrawalRequest>()
            runCatching { rejectUseCase.execute(staffId, withdrawalId, request.reason) }
                .fold(
                    onSuccess = { call.respond(HttpStatusCode.OK, it) },
                    onFailure = { call.handleWithdrawalError(it) },
                )
        }
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.parseWithdrawalId(): UUID? {
    val raw =
        parameters["withdrawalId"] ?: run {
            respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing withdrawalId"))
            return null
        }
    return runCatching { UUID.fromString(raw) }.getOrElse {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid withdrawalId"))
        null
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.parseStaffId(): UUID? {
    val raw =
        request.headers["X-Staff-Id"] ?: run {
            respond(HttpStatusCode.Unauthorized, mapOf("error" to "Missing X-Staff-Id header"))
            return null
        }
    return runCatching { UUID.fromString(raw) }.getOrElse {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid staff ID"))
        null
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.handleWithdrawalError(ex: Throwable) {
    when (ex) {
        is WithdrawalNotFoundException ->
            respond(HttpStatusCode.NotFound, mapOf("error" to ex.message))
        is WithdrawalStateException ->
            respond(HttpStatusCode.Conflict, mapOf("error" to ex.message))
        is InsufficientBalanceException ->
            respond(HttpStatusCode.PaymentRequired, mapOf("error" to ex.message))
        is TransferFailedException ->
            respond(HttpStatusCode.BadGateway, mapOf("error" to ex.message))
        is IllegalArgumentException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to ex.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to ex.message))
    }
}
