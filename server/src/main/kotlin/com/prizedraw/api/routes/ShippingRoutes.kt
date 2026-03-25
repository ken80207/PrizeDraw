package com.prizedraw.api.routes

import com.prizedraw.api.mappers.toDto
import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.input.shipping.ICancelShippingOrderUseCase
import com.prizedraw.application.ports.input.shipping.IConfirmDeliveryUseCase
import com.prizedraw.application.ports.input.shipping.ICreateShippingOrderUseCase
import com.prizedraw.application.ports.input.shipping.IFulfillShippingOrderUseCase
import com.prizedraw.application.ports.output.IShippingRepository
import com.prizedraw.application.usecases.shipping.CancellationNotAllowedException
import com.prizedraw.application.usecases.shipping.PrizeNotHoldingException
import com.prizedraw.application.usecases.shipping.ShippingNotFoundException
import com.prizedraw.contracts.dto.shipping.CreateShippingOrderRequest
import com.prizedraw.contracts.dto.shipping.UpdateShippingRequest
import com.prizedraw.contracts.endpoints.AdminEndpoints
import com.prizedraw.contracts.endpoints.ShippingEndpoints
import com.prizedraw.contracts.enums.ShippingOrderStatus
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import org.koin.ktor.ext.inject
import java.util.UUID

/**
 * Registers shipping order routes for both players and admin.
 *
 * Player routes (require JWT `player` auth):
 * - POST   [ShippingEndpoints.ORDERS]                  -- Create a new shipping order.
 * - DELETE [ShippingEndpoints.ORDER_BY_ID]             -- Cancel a PENDING_SHIPMENT order.
 * - POST   [ShippingEndpoints.CONFIRM_DELIVERY]        -- Player confirms delivery.
 *
 * Admin routes (require JWT `admin` auth):
 * - GET [AdminEndpoints.SHIPPING_ORDERS]            -- List all orders (paginated, by status).
 * - GET [AdminEndpoints.SHIPPING_ORDER_BY_ID]       -- Get order detail.
 * - PATCH  `admin/shipping/orders/{orderId}/ship`      -- Fulfill order (tracking + SHIPPED).
 */
public fun Route.shippingRoutes() {
    val createUseCase: ICreateShippingOrderUseCase by inject()
    val cancelUseCase: ICancelShippingOrderUseCase by inject()
    val confirmUseCase: IConfirmDeliveryUseCase by inject()
    val fulfillUseCase: IFulfillShippingOrderUseCase by inject()
    val shippingRepository: IShippingRepository by inject()

    authenticate("player") {
        post(ShippingEndpoints.ORDERS) {
            handleCreateOrder(createUseCase)
        }
        delete(ShippingEndpoints.ORDER_BY_ID) {
            handleCancelOrder(cancelUseCase)
        }
        post(ShippingEndpoints.CONFIRM_DELIVERY) {
            handleConfirmDelivery(confirmUseCase)
        }
    }

    authenticate("admin") {
        get(AdminEndpoints.SHIPPING_ORDERS) {
            handleAdminListOrders(shippingRepository)
        }
        get(AdminEndpoints.SHIPPING_ORDER_BY_ID) {
            handleAdminGetOrder(shippingRepository)
        }
        patch("${AdminEndpoints.SHIPPING_ORDER_BY_ID}/ship") {
            handleAdminFulfill(fulfillUseCase)
        }
    }
}

private suspend fun io.ktor.server.routing.RoutingContext.handleCreateOrder(
    createUseCase: ICreateShippingOrderUseCase,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val request = call.receive<CreateShippingOrderRequest>()
    runCatching { createUseCase.execute(principal.playerId, request) }
        .fold(
            onSuccess = { call.respond(HttpStatusCode.Created, it) },
            onFailure = { call.handleShippingError(it) },
        )
}

private suspend fun io.ktor.server.routing.RoutingContext.handleCancelOrder(
    cancelUseCase: ICancelShippingOrderUseCase,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val orderId = call.parseOrderId() ?: return
    runCatching { cancelUseCase.execute(principal.playerId, orderId) }
        .fold(
            onSuccess = { call.respond(HttpStatusCode.NoContent) },
            onFailure = { call.handleShippingError(it) },
        )
}

private suspend fun io.ktor.server.routing.RoutingContext.handleConfirmDelivery(
    confirmUseCase: IConfirmDeliveryUseCase,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val orderId = call.parseOrderId() ?: return
    runCatching { confirmUseCase.execute(orderId, principal.playerId) }
        .fold(
            onSuccess = { call.respond(HttpStatusCode.NoContent) },
            onFailure = { call.handleShippingError(it) },
        )
}

private suspend fun io.ktor.server.routing.RoutingContext.handleAdminListOrders(
    shippingRepository: IShippingRepository,
) {
    val statusParam = call.request.queryParameters["status"]
    val status =
        statusParam?.let {
            runCatching { ShippingOrderStatus.valueOf(it) }.getOrNull()
        }
    val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
    val limit =
        (call.request.queryParameters["limit"]?.toIntOrNull() ?: DEFAULT_PAGE_SIZE)
            .coerceIn(1, MAX_PAGE_SIZE)
    val orders =
        shippingRepository.findByStatus(
            status = status ?: ShippingOrderStatus.PENDING_SHIPMENT,
            offset = offset,
            limit = limit,
        )
    call.respond(HttpStatusCode.OK, orders.map { it.toDto() })
}

private suspend fun io.ktor.server.routing.RoutingContext.handleAdminGetOrder(
    shippingRepository: IShippingRepository,
) {
    val orderId = call.parseOrderId() ?: return
    val order =
        shippingRepository.findById(orderId)
            ?: run {
                call.respond(HttpStatusCode.NotFound, mapOf("error" to "Order not found"))
                return
            }
    call.respond(HttpStatusCode.OK, order.toDto())
}

private suspend fun io.ktor.server.routing.RoutingContext.handleAdminFulfill(
    fulfillUseCase: IFulfillShippingOrderUseCase,
) {
    val orderId = call.parseOrderId() ?: return
    val request = call.receive<UpdateShippingRequest>()
    val staffIdStr = call.request.headers["X-Staff-Id"]
    val staffId =
        staffIdStr?.let { runCatching { UUID.fromString(it) }.getOrNull() }
            ?: UUID.fromString("00000000-0000-0000-0000-000000000001")
    runCatching {
        fulfillUseCase.execute(orderId, request.trackingNumber, request.carrier, staffId)
    }.fold(
        onSuccess = { call.respond(HttpStatusCode.NoContent) },
        onFailure = { call.handleShippingError(it) },
    )
}

private suspend fun io.ktor.server.application.ApplicationCall.parseOrderId(): UUID? {
    val raw =
        parameters["orderId"] ?: run {
            respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing orderId"))
            return null
        }
    return runCatching { UUID.fromString(raw) }.getOrElse {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid orderId"))
        null
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.handleShippingError(ex: Throwable) {
    when (ex) {
        is ShippingNotFoundException ->
            respond(HttpStatusCode.NotFound, mapOf("error" to ex.message))
        is CancellationNotAllowedException ->
            respond(HttpStatusCode.Conflict, mapOf("error" to ex.message))
        is PrizeNotHoldingException ->
            respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to ex.message))
        is IllegalArgumentException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to ex.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to ex.message))
    }
}

private const val DEFAULT_PAGE_SIZE = 20
private const val MAX_PAGE_SIZE = 100
