package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.input.buyback.IBuybackUseCase
import com.prizedraw.application.ports.input.buyback.IGetBuybackPriceUseCase
import com.prizedraw.application.usecases.buyback.BuybackDisabledException
import com.prizedraw.application.usecases.buyback.PrizeNotAvailableForBuybackException
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import java.util.UUID

/**
 * Registers buyback routes. All routes require JWT `player` authentication.
 *
 * - POST /api/v1/prizes/{prizeInstanceId}/buyback          — Execute buyback.
 * - GET  /api/v1/prizes/buyback-price/{prizeInstanceId}    — Preview buyback price.
 */
public fun Route.buybackRoutes() {
    val buybackUseCase: IBuybackUseCase by inject()
    val priceUseCase: IGetBuybackPriceUseCase by inject()

    authenticate("player") {
        post("/api/v1/prizes/{prizeInstanceId}/buyback") {
            val principal = call.principal<PlayerPrincipal>()!!
            val prizeInstanceId = call.parsePrizeInstanceId() ?: return@post
            runCatching { buybackUseCase.execute(principal.playerId, prizeInstanceId) }
                .fold(
                    onSuccess = { credited ->
                        call.respond(
                            HttpStatusCode.OK,
                            mapOf("revenuePointsCredited" to credited),
                        )
                    },
                    onFailure = { call.handleBuybackError(it) },
                )
        }

        get("/api/v1/prizes/buyback-price/{prizeInstanceId}") {
            val principal = call.principal<PlayerPrincipal>()!!
            val prizeInstanceId = call.parsePrizeInstanceId() ?: return@get
            runCatching { priceUseCase.execute(principal.playerId, prizeInstanceId) }
                .fold(
                    onSuccess = { price ->
                        call.respond(HttpStatusCode.OK, mapOf("buybackPrice" to price))
                    },
                    onFailure = { call.handleBuybackError(it) },
                )
        }
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.parsePrizeInstanceId(): PrizeInstanceId? {
    val raw =
        parameters["prizeInstanceId"] ?: run {
            respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing prizeInstanceId"))
            return null
        }
    return runCatching { PrizeInstanceId(UUID.fromString(raw)) }.getOrElse {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid prizeInstanceId"))
        null
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.handleBuybackError(ex: Throwable) {
    when (ex) {
        is BuybackDisabledException ->
            respond(HttpStatusCode.Forbidden, mapOf("error" to ex.message))
        is PrizeNotAvailableForBuybackException ->
            respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to ex.message))
        is IllegalArgumentException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to ex.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to ex.message))
    }
}
