package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.application.ports.output.ITradeRepository
import com.prizedraw.contracts.endpoints.AdminEndpoints
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.entities.TradeListing
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.Serializable

/**
 * Admin routes for trade marketplace management.
 *
 * All routes require `authenticate("staff")` in the parent scope.
 *
 * - GET [AdminEndpoints.TRADE_LISTINGS] — List active trade listings (paginated)
 */
public fun Route.adminTradeRoutes() {
    val tradeRepository: ITradeRepository by inject()

    get(AdminEndpoints.TRADE_LISTINGS) {
        call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@get
        val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
        val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: 100).coerceIn(1, 200)

        val listings = tradeRepository.findActiveListings(offset = offset, limit = limit)
        call.respond(HttpStatusCode.OK, listings.map { it.toAdminResponse() })
    }
}

@Serializable
private data class AdminTradeListingResponse(
    val id: String,
    val sellerId: String,
    val buyerId: String?,
    val prizeInstanceId: String,
    val listPrice: String,
    val feeRateBps: String,
    val feeAmount: String?,
    val sellerProceeds: String?,
    val status: String,
    val listedAt: String,
    val completedAt: String?,
    val cancelledAt: String?,
    val createdAt: String,
)

private fun TradeListing.toAdminResponse(): AdminTradeListingResponse =
    AdminTradeListingResponse(
        id = id.toString(),
        sellerId = sellerId.value.toString(),
        buyerId = buyerId?.value?.toString(),
        prizeInstanceId = prizeInstanceId.value.toString(),
        listPrice = listPrice.toString(),
        feeRateBps = feeRateBps.toString(),
        feeAmount = feeAmount?.toString(),
        sellerProceeds = sellerProceeds?.toString(),
        status = status.name,
        listedAt = listedAt.toString(),
        completedAt = completedAt?.toString(),
        cancelledAt = cancelledAt?.toString(),
        createdAt = createdAt.toString(),
    )
