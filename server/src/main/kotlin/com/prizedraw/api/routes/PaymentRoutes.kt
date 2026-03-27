package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.input.payment.IConfirmPaymentWebhookUseCase
import com.prizedraw.application.ports.input.payment.ICreatePaymentOrderUseCase
import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.usecases.payment.PackageNotFoundException
import com.prizedraw.application.usecases.payment.WebhookVerificationException
import com.prizedraw.application.usecases.payment.defaultPointsPackages
import com.prizedraw.application.usecases.payment.toDto
import com.prizedraw.contracts.dto.payment.CreatePaymentOrderRequest
import com.prizedraw.contracts.dto.payment.MockTopUpRequest
import com.prizedraw.contracts.dto.payment.MockTopUpResponse
import com.prizedraw.contracts.endpoints.PaymentEndpoints
import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.PaymentGateway
import com.prizedraw.domain.entities.DrawPointTransaction
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.request.receiveText
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import kotlinx.datetime.Clock
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/**
 * Registers payment and points package routes.
 *
 * Public endpoints:
 * - GET  [PaymentEndpoints.PACKAGES]          — List all active points packages
 * - POST [PaymentEndpoints.WEBHOOK]/{gateway} — Inbound payment gateway webhook
 *
 * Protected endpoints (JWT required):
 * - POST [PaymentEndpoints.ORDERS]            — Create a new payment order
 * - POST [PaymentEndpoints.MOCK_TOP_UP]       — Dev/test only: credit points without a gateway
 */
public fun Route.paymentRoutes() {
    val createPaymentOrderUseCase: ICreatePaymentOrderUseCase by inject()
    val confirmPaymentWebhookUseCase: IConfirmPaymentWebhookUseCase by inject()
    val playerRepository: IPlayerRepository by inject()
    val drawPointTransactionRepository: IDrawPointTransactionRepository by inject()

    get(PaymentEndpoints.PACKAGES) {
        val packages = defaultPointsPackages().filter { it.isActive }.map { it.toDto() }
        call.respond(HttpStatusCode.OK, packages)
    }

    authenticate("player") {
        post(PaymentEndpoints.ORDERS) {
            val principal = call.principal<PlayerPrincipal>()!!
            val request = call.receive<CreatePaymentOrderRequest>()
            try {
                val intent = createPaymentOrderUseCase.execute(principal.playerId, request.pointsPackageId)
                call.respond(HttpStatusCode.Created, intent)
            } catch (e: PackageNotFoundException) {
                call.respond(HttpStatusCode.NotFound, mapOf("error" to e.message))
            }
        }

        post(PaymentEndpoints.MOCK_TOP_UP) {
            val principal = call.principal<PlayerPrincipal>()!!
            val request = call.receive<MockTopUpRequest>()

            if (request.points <= 0 || request.points > 100_000) {
                call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to "points must be between 1 and 100000"),
                )
                return@post
            }

            val playerId = principal.playerId
            val response =
                newSuspendedTransaction {
                    val player =
                        playerRepository.findById(playerId)
                            ?: error("Player $playerId not found")

                    val success =
                        playerRepository.updateBalance(
                            id = playerId,
                            drawPointsDelta = request.points,
                            revenuePointsDelta = 0,
                            expectedVersion = player.version,
                        )
                    check(success) {
                        "Failed to update balance due to concurrent modification — please retry"
                    }

                    val newBalance = player.drawPointsBalance + request.points
                    drawPointTransactionRepository.record(
                        DrawPointTransaction(
                            id = UUID.randomUUID(),
                            playerId = playerId,
                            type = DrawPointTxType.PURCHASE_CREDIT,
                            amount = request.points,
                            balanceAfter = newBalance,
                            paymentOrderId = null,
                            description = "Mock top-up: ${request.points} draw points",
                            createdAt = Clock.System.now(),
                        ),
                    )

                    MockTopUpResponse(
                        pointsCredited = request.points,
                        newBalance = newBalance,
                    )
                }

            call.respond(HttpStatusCode.OK, response)
        }
    }

    post(PaymentEndpoints.WEBHOOK) {
        val gatewayParam =
            call.parameters["gateway"] ?: run {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing gateway parameter"))
                return@post
            }
        val gateway =
            runCatching { PaymentGateway.valueOf(gatewayParam.uppercase()) }.getOrElse {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Unknown gateway: $gatewayParam"))
                return@post
            }

        val payload = call.receiveText()
        val signature = call.request.headers["X-Payment-Signature"] ?: ""

        try {
            confirmPaymentWebhookUseCase.execute(gateway, payload, signature)
            call.respond(HttpStatusCode.OK, mapOf("status" to "ok"))
        } catch (e: WebhookVerificationException) {
            call.respond(HttpStatusCode.Unauthorized, mapOf("error" to e.message))
        }
    }
}
