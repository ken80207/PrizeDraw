package com.prizedraw.api.routes

import com.prizedraw.api.mappers.toDto
import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.input.trade.ICancelTradeListingUseCase
import com.prizedraw.application.ports.input.trade.ICreateTradeListingUseCase
import com.prizedraw.application.ports.input.trade.IPurchaseTradeListingUseCase
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ITradeRepository
import com.prizedraw.application.usecases.trade.InsufficientDrawPointsException
import com.prizedraw.application.usecases.trade.ListingNotAvailableException
import com.prizedraw.application.usecases.trade.PrizeNotAvailableForTradeException
import com.prizedraw.application.usecases.trade.SelfPurchaseException
import com.prizedraw.application.usecases.trade.TradeListingNotFoundException
import com.prizedraw.contracts.dto.trade.CreateListingRequest
import com.prizedraw.contracts.dto.trade.TradeListingPageDto
import com.prizedraw.contracts.endpoints.TradeEndpoints
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
import java.util.UUID

/**
 * Registers trade marketplace routes. All routes require JWT `player` authentication.
 *
 * - GET [TradeEndpoints.LISTINGS]              -- Browse marketplace (paginated).
 * - GET [TradeEndpoints.LISTING_BY_ID]         -- Get a single listing detail.
 * - POST   [TradeEndpoints.LISTINGS]              -- Create a new listing.
 * - POST   [TradeEndpoints.PURCHASE]              -- Purchase a listing.
 * - DELETE [TradeEndpoints.LISTING_BY_ID]         -- Cancel own listing.
 */
public fun Route.tradeRoutes() {
    val createUseCase: ICreateTradeListingUseCase by inject()
    val purchaseUseCase: IPurchaseTradeListingUseCase by inject()
    val cancelUseCase: ICancelTradeListingUseCase by inject()
    val tradeRepository: ITradeRepository by inject()
    val playerRepository: IPlayerRepository by inject()
    val prizeRepository: IPrizeRepository by inject()

    authenticate("player") {
        get(TradeEndpoints.LISTINGS) {
            handleListListings(tradeRepository, playerRepository, prizeRepository)
        }

        get(TradeEndpoints.LISTING_BY_ID) {
            handleGetListing(tradeRepository, playerRepository, prizeRepository)
        }

        post(TradeEndpoints.LISTINGS) {
            handleCreateListing(createUseCase)
        }

        post(TradeEndpoints.PURCHASE) {
            handlePurchaseListing(purchaseUseCase)
        }

        delete(TradeEndpoints.LISTING_BY_ID) {
            handleCancelListing(cancelUseCase)
        }
    }
}

private suspend fun io.ktor.server.routing.RoutingContext.handleListListings(
    tradeRepository: ITradeRepository,
    playerRepository: IPlayerRepository,
    prizeRepository: IPrizeRepository,
) {
    val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
    val limit =
        (call.request.queryParameters["limit"]?.toIntOrNull() ?: DEFAULT_PAGE_SIZE)
            .coerceIn(1, MAX_PAGE_SIZE)
    val listings = tradeRepository.findActiveListings(offset, limit)
    val dtos =
        listings.mapNotNull { listing ->
            val seller =
                playerRepository.findById(listing.sellerId)
                    ?: return@mapNotNull null
            val instance =
                prizeRepository.findInstanceById(listing.prizeInstanceId)
                    ?: return@mapNotNull null
            val definition =
                prizeRepository.findDefinitionById(instance.prizeDefinitionId)
                    ?: return@mapNotNull null
            listing.toDto(seller, definition)
        }
    call.respond(HttpStatusCode.OK, TradeListingPageDto(dtos, dtos.size, offset / limit, limit))
}

private suspend fun io.ktor.server.routing.RoutingContext.handleGetListing(
    tradeRepository: ITradeRepository,
    playerRepository: IPlayerRepository,
    prizeRepository: IPrizeRepository,
) {
    val listingId = call.parseListingId() ?: return
    val listing =
        tradeRepository.findById(listingId)
            ?: run {
                call.respond(HttpStatusCode.NotFound, mapOf("error" to "Listing not found"))
                return
            }
    val seller =
        playerRepository.findById(listing.sellerId)
            ?: run {
                call.respond(HttpStatusCode.NotFound, mapOf("error" to "Seller not found"))
                return
            }
    val instance =
        prizeRepository.findInstanceById(listing.prizeInstanceId)
            ?: run {
                call.respond(HttpStatusCode.NotFound, mapOf("error" to "Prize not found"))
                return
            }
    val definition =
        prizeRepository.findDefinitionById(instance.prizeDefinitionId)
            ?: run {
                call.respond(HttpStatusCode.NotFound, mapOf("error" to "Definition not found"))
                return
            }
    call.respond(HttpStatusCode.OK, listing.toDto(seller, definition))
}

private suspend fun io.ktor.server.routing.RoutingContext.handleCreateListing(
    createUseCase: ICreateTradeListingUseCase,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val request = call.receive<CreateListingRequest>()
    runCatching { createUseCase.execute(principal.playerId, request) }
        .fold(
            onSuccess = { call.respond(HttpStatusCode.Created, it) },
            onFailure = { call.handleTradeError(it) },
        )
}

private suspend fun io.ktor.server.routing.RoutingContext.handlePurchaseListing(
    purchaseUseCase: IPurchaseTradeListingUseCase,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val listingId = call.parseListingId() ?: return
    runCatching { purchaseUseCase.execute(principal.playerId, listingId) }
        .fold(
            onSuccess = { call.respond(HttpStatusCode.OK, it) },
            onFailure = { call.handleTradeError(it) },
        )
}

private suspend fun io.ktor.server.routing.RoutingContext.handleCancelListing(
    cancelUseCase: ICancelTradeListingUseCase,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val listingId = call.parseListingId() ?: return
    runCatching { cancelUseCase.execute(principal.playerId, listingId) }
        .fold(
            onSuccess = { call.respond(HttpStatusCode.NoContent) },
            onFailure = { call.handleTradeError(it) },
        )
}

private suspend fun io.ktor.server.application.ApplicationCall.parseListingId(): UUID? {
    val raw =
        parameters["listingId"] ?: run {
            respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing listingId"))
            return null
        }
    return runCatching { UUID.fromString(raw) }.getOrElse {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid listingId"))
        null
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.handleTradeError(ex: Throwable) {
    when (ex) {
        is TradeListingNotFoundException ->
            respond(HttpStatusCode.NotFound, mapOf("error" to ex.message))
        is SelfPurchaseException ->
            respond(HttpStatusCode.Forbidden, mapOf("error" to ex.message))
        is ListingNotAvailableException ->
            respond(HttpStatusCode.Conflict, mapOf("error" to ex.message))
        is InsufficientDrawPointsException ->
            respond(HttpStatusCode.PaymentRequired, mapOf("error" to ex.message))
        is PrizeNotAvailableForTradeException ->
            respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to ex.message))
        is IllegalArgumentException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to ex.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to ex.message))
    }
}

private const val DEFAULT_PAGE_SIZE = 20
private const val MAX_PAGE_SIZE = 100
