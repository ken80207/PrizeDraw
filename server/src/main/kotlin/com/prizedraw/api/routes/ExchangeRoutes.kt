package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.input.exchange.ICancelExchangeRequestUseCase
import com.prizedraw.application.ports.input.exchange.ICreateExchangeRequestUseCase
import com.prizedraw.application.ports.input.exchange.IRespondExchangeRequestUseCase
import com.prizedraw.application.ports.output.IExchangeRepository
import com.prizedraw.application.usecases.exchange.ExchangeNotPendingException
import com.prizedraw.application.usecases.exchange.ExchangeRequestNotFoundException
import com.prizedraw.application.usecases.exchange.ExchangeUnauthorizedException
import com.prizedraw.application.usecases.exchange.FeatureDisabledException
import com.prizedraw.application.usecases.exchange.PrizeNotAvailableForExchangeException
import com.prizedraw.contracts.dto.exchange.CreateExchangeRequest
import com.prizedraw.contracts.dto.exchange.RespondExchangeRequest
import com.prizedraw.contracts.endpoints.ExchangeEndpoints
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import org.koin.ktor.ext.inject
import java.util.UUID

/**
 * Registers exchange request routes. All routes require JWT `player` authentication.
 *
 * - GET [ExchangeEndpoints.OFFERS]       — List my exchange offers (sent + received).
 * - POST   [ExchangeEndpoints.OFFERS]       — Create a new exchange offer.
 * - POST   [ExchangeEndpoints.RESPOND]      — Accept, reject, or counter-propose.
 * - DELETE [ExchangeEndpoints.OFFER_BY_ID]  — Cancel an exchange offer.
 */
public fun Route.exchangeRoutes() {
    val createUseCase: ICreateExchangeRequestUseCase by inject()
    val respondUseCase: IRespondExchangeRequestUseCase by inject()
    val cancelUseCase: ICancelExchangeRequestUseCase by inject()
    val exchangeRepository: IExchangeRepository by inject()

    authenticate("player") {
        get(ExchangeEndpoints.OFFERS) {
            val principal = call.principal<PlayerPrincipal>()!!
            val offers = exchangeRepository.findByPlayer(principal.playerId)
            call.respond(HttpStatusCode.OK, offers)
        }

        post(ExchangeEndpoints.OFFERS) {
            val principal = call.principal<PlayerPrincipal>()!!
            val request = call.receive<CreateExchangeRequest>()
            runCatching { createUseCase.execute(principal.playerId, request) }
                .fold(
                    onSuccess = { call.respond(HttpStatusCode.Created, it) },
                    onFailure = { call.handleExchangeError(it) },
                )
        }

        post(ExchangeEndpoints.RESPOND) {
            val principal = call.principal<PlayerPrincipal>()!!
            val offerId = call.parseOfferId() ?: return@post
            val response = call.receive<RespondExchangeRequest>()
            runCatching { respondUseCase.execute(principal.playerId, offerId, response) }
                .fold(
                    onSuccess = { call.respond(HttpStatusCode.OK, it) },
                    onFailure = { call.handleExchangeError(it) },
                )
        }

        delete(ExchangeEndpoints.OFFER_BY_ID) {
            val principal = call.principal<PlayerPrincipal>()!!
            val offerId = call.parseOfferId() ?: return@delete
            runCatching { cancelUseCase.execute(principal.playerId, offerId) }
                .fold(
                    onSuccess = { call.respond(HttpStatusCode.NoContent) },
                    onFailure = { call.handleExchangeError(it) },
                )
        }
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.parseOfferId(): UUID? {
    val raw =
        parameters["offerId"] ?: run {
            respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing offerId"))
            return null
        }
    return runCatching { UUID.fromString(raw) }.getOrElse {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid offerId"))
        null
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.handleExchangeError(ex: Throwable) {
    when (ex) {
        is FeatureDisabledException ->
            respond(HttpStatusCode.Forbidden, mapOf("error" to ex.message))
        is ExchangeRequestNotFoundException ->
            respond(HttpStatusCode.NotFound, mapOf("error" to ex.message))
        is ExchangeUnauthorizedException ->
            respond(HttpStatusCode.Forbidden, mapOf("error" to ex.message))
        is ExchangeNotPendingException ->
            respond(HttpStatusCode.Conflict, mapOf("error" to ex.message))
        is PrizeNotAvailableForExchangeException ->
            respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to ex.message))
        is IllegalArgumentException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to ex.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to ex.message))
    }
}
