package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.input.payment.IConfirmPaymentWebhookUseCase
import com.prizedraw.application.ports.input.payment.ICreatePaymentOrderUseCase
import com.prizedraw.application.usecases.payment.PackageNotFoundException
import com.prizedraw.application.usecases.payment.WebhookVerificationException
import com.prizedraw.application.usecases.payment.defaultPointsPackages
import com.prizedraw.application.usecases.payment.toDto
import com.prizedraw.contracts.dto.payment.CreatePaymentOrderRequest
import com.prizedraw.contracts.endpoints.PaymentEndpoints
import com.prizedraw.contracts.enums.PaymentGateway
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
import org.koin.ktor.ext.inject

/**
 * Registers payment and points package routes.
 *
 * Public endpoints:
 * - GET  [PaymentEndpoints.PACKAGES]         — List all active points packages
 * - POST [PaymentEndpoints.WEBHOOK]/{gateway} — Inbound payment gateway webhook
 *
 * Protected endpoints (JWT required):
 * - POST [PaymentEndpoints.ORDERS]           — Create a new payment order
 */
public fun Route.paymentRoutes() {
    val createPaymentOrderUseCase: ICreatePaymentOrderUseCase by inject()
    val confirmPaymentWebhookUseCase: IConfirmPaymentWebhookUseCase by inject()

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
