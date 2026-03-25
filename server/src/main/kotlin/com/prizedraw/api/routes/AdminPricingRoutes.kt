package com.prizedraw.api.routes

import com.prizedraw.api.plugins.StaffPrincipal
import com.prizedraw.api.plugins.satisfies
import com.prizedraw.application.ports.input.admin.IUpdateBuybackPriceUseCase
import com.prizedraw.application.ports.input.admin.IUpdateTradeFeeRateUseCase
import com.prizedraw.application.usecases.admin.InvalidBuybackPriceException
import com.prizedraw.application.usecases.admin.InvalidTradeFeeRateException
import com.prizedraw.application.usecases.admin.PrizeDefinitionNotFoundException
import com.prizedraw.contracts.dto.admin.TradeFeeRateDto
import com.prizedraw.contracts.dto.admin.UpdateBuybackPriceRequest
import com.prizedraw.contracts.dto.admin.UpdateTradeFeeRateRequest
import com.prizedraw.contracts.dto.campaign.PrizeDefinitionDto
import com.prizedraw.contracts.endpoints.AdminEndpoints
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.call
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.patch
import kotlinx.datetime.Clock
import org.koin.ktor.ext.inject
import java.util.UUID

/**
 * Registers admin pricing management routes.
 *
 * All routes require `authenticate("staff")` and [StaffRole.ADMIN] or above.
 *
 * - PATCH [AdminEndpoints.PRICING_BUYBACK]    -- update buyback price for a prize definition
 * - PATCH [AdminEndpoints.PRICING_TRADE_FEE]  -- update global trade fee rate
 */
public fun Route.adminPricingRoutes() {
    val updateBuyback: IUpdateBuybackPriceUseCase by inject()
    val updateTradeFee: IUpdateTradeFeeRateUseCase by inject()

    patch(AdminEndpoints.PRICING_BUYBACK) {
        val staff = call.requireAdminStaff() ?: return@patch
        val prizeDefId = call.parsePrizeDefinitionId() ?: return@patch
        val req = call.receive<UpdateBuybackPriceRequest>()
        runCatching {
            updateBuyback.execute(
                staffId = staff.staffId,
                prizeDefinitionId = prizeDefId,
                buybackPrice = req.buybackPrice,
                buybackEnabled = req.buybackEnabled,
            )
        }.fold(
            onSuccess = { prize -> call.respond(HttpStatusCode.OK, prize.toDto()) },
            onFailure = { e -> call.respondPricingError(e) },
        )
    }

    patch(AdminEndpoints.PRICING_TRADE_FEE) {
        val staff = call.requireAdminStaff() ?: return@patch
        val req = call.receive<UpdateTradeFeeRateRequest>()
        runCatching {
            updateTradeFee.execute(
                staffId = staff.staffId,
                tradeFeeRateBps = req.tradeFeeRateBps,
            )
        }.fold(
            onSuccess = { rate ->
                call.respond(
                    HttpStatusCode.OK,
                    TradeFeeRateDto(tradeFeeRateBps = rate, updatedAt = Clock.System.now()),
                )
            },
            onFailure = { e -> call.respondPricingError(e) },
        )
    }
}

// --- Helpers ---

private suspend fun ApplicationCall.requireAdminStaff(): StaffPrincipal? {
    val staff = principal<StaffPrincipal>()
    if (staff == null) {
        respond(HttpStatusCode.Unauthorized, mapOf("error" to "Authentication required"))
        return null
    }
    if (!staff.role.satisfies(StaffRole.ADMIN)) {
        respond(HttpStatusCode.Forbidden, mapOf("error" to "Requires ADMIN role or above"))
        return null
    }
    return staff
}

private suspend fun ApplicationCall.parsePrizeDefinitionId(): PrizeDefinitionId? {
    val raw =
        parameters["prizeDefinitionId"] ?: run {
            respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing prizeDefinitionId"))
            return null
        }
    return runCatching { PrizeDefinitionId(UUID.fromString(raw)) }.getOrElse {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid prizeDefinitionId"))
        null
    }
}

private suspend fun ApplicationCall.respondPricingError(e: Throwable) {
    when (e) {
        is InvalidBuybackPriceException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
        is InvalidTradeFeeRateException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
        is PrizeDefinitionNotFoundException ->
            respond(HttpStatusCode.NotFound, mapOf("error" to e.message))
        is IllegalArgumentException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to "Unexpected error"))
    }
}

private fun PrizeDefinition.toDto(): PrizeDefinitionDto =
    PrizeDefinitionDto(
        id = id.value.toString(),
        grade = grade,
        name = name,
        photos = photos,
        buybackPrice = buybackPrice,
        buybackEnabled = buybackEnabled,
        probabilityBps = probabilityBps,
        ticketCount = ticketCount,
        displayOrder = displayOrder,
    )
