package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.input.player.IGetPlayerProfileUseCase
import com.prizedraw.application.ports.input.player.IGetPrizeInventoryUseCase
import com.prizedraw.application.ports.input.player.IUpdateAnimationPreferenceUseCase
import com.prizedraw.application.ports.input.player.IUpdatePlayerProfileUseCase
import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IRevenuePointTransactionRepository
import com.prizedraw.application.usecases.auth.PlayerNotFoundException
import com.prizedraw.application.usecases.player.PrizeNotFoundException
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.contracts.dto.player.DrawPointTransactionDto
import com.prizedraw.contracts.dto.player.UpdatePlayerRequest
import com.prizedraw.contracts.dto.player.WalletDto
import com.prizedraw.contracts.endpoints.PlayerEndpoints
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import kotlinx.serialization.Serializable
import java.util.UUID
import com.prizedraw.domain.valueobjects.PlayerId as DomainPlayerId

/**
 * Registers player profile and wallet routes. All routes require JWT authentication.
 *
 * - GET   [PlayerEndpoints.ME]                      — Retrieve authenticated player's profile
 * - PATCH [PlayerEndpoints.ME]                      — Update nickname / avatarUrl / locale
 * - GET   [PlayerEndpoints.ME_PRIZES]               — List the authenticated player's prizes
 * - GET   [PlayerEndpoints.ME_PRIZE_DETAIL]         — Get a single prize instance with joined definition data
 * - GET   [PlayerEndpoints.ME_WALLET]               — Retrieve point balances and transaction history
 * - PATCH [PlayerEndpoints.ME_ANIMATION_PREFERENCE] — Update preferred draw animation mode
 * - GET   [PlayerEndpoints.PUBLIC_PRIZES]           — List a player's HOLDING prizes visible to others
 */
public fun Route.playerRoutes() {
    val getProfileUseCase: IGetPlayerProfileUseCase by inject()
    val updateProfileUseCase: IUpdatePlayerProfileUseCase by inject()
    val updateAnimationPreferenceUseCase: IUpdateAnimationPreferenceUseCase by inject()
    val playerRepository: IPlayerRepository by inject()
    val drawPointTransactionRepository: IDrawPointTransactionRepository by inject()
    val revenuePointTransactionRepository: IRevenuePointTransactionRepository by inject()
    val prizeInventoryUseCase: IGetPrizeInventoryUseCase by inject()
    val prizeRepository: IPrizeRepository by inject()

    authenticate("player") {
        get(PlayerEndpoints.ME) {
            handleGetProfile(getProfileUseCase)
        }

        patch(PlayerEndpoints.ME) {
            handleUpdateProfile(updateProfileUseCase)
        }

        get(PlayerEndpoints.ME_PRIZES) {
            handleListPrizes(prizeInventoryUseCase)
        }

        get(PlayerEndpoints.ME_PRIZE_DETAIL) {
            handleGetPrize(prizeInventoryUseCase)
        }

        get(PlayerEndpoints.ME_WALLET) {
            handleGetWallet(playerRepository, drawPointTransactionRepository, revenuePointTransactionRepository)
        }

        patch(PlayerEndpoints.ME_ANIMATION_PREFERENCE) {
            handleUpdateAnimationPreference(updateAnimationPreferenceUseCase)
        }
    }

    authenticate("player") {
        get(PlayerEndpoints.PUBLIC_PRIZES) {
            handleGetPublicPrizes(prizeRepository)
        }
    }
}

private suspend fun io.ktor.server.routing.RoutingContext.handleGetProfile(
    getProfileUseCase: IGetPlayerProfileUseCase,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    try {
        val player = getProfileUseCase.execute(principal.playerId)
        call.respond(HttpStatusCode.OK, player)
    } catch (e: PlayerNotFoundException) {
        call.respond(HttpStatusCode.NotFound, mapOf("error" to e.message))
    }
}

private suspend fun io.ktor.server.routing.RoutingContext.handleUpdateProfile(
    updateProfileUseCase: IUpdatePlayerProfileUseCase,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val request = call.receive<UpdatePlayerRequest>()
    try {
        val player = updateProfileUseCase.execute(principal.playerId, request)
        call.respond(HttpStatusCode.OK, player)
    } catch (e: PlayerNotFoundException) {
        call.respond(HttpStatusCode.NotFound, mapOf("error" to e.message))
    } catch (e: IllegalArgumentException) {
        call.respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to e.message))
    }
}

private suspend fun io.ktor.server.routing.RoutingContext.handleListPrizes(
    prizeInventoryUseCase: IGetPrizeInventoryUseCase,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val prizes = prizeInventoryUseCase.list(principal.playerId)
    call.respond(HttpStatusCode.OK, prizes)
}

private suspend fun io.ktor.server.routing.RoutingContext.handleGetPrize(
    prizeInventoryUseCase: IGetPrizeInventoryUseCase,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val rawId =
        call.parameters["prizeId"] ?: run {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing prizeId"))
            return
        }
    val prizeId =
        runCatching { PrizeInstanceId(UUID.fromString(rawId)) }.getOrElse {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid prizeId"))
            return
        }
    try {
        val prize = prizeInventoryUseCase.getOne(principal.playerId, prizeId)
        call.respond(HttpStatusCode.OK, prize)
    } catch (e: PrizeNotFoundException) {
        call.respond(HttpStatusCode.NotFound, mapOf("error" to e.message))
    }
}

private suspend fun io.ktor.server.routing.RoutingContext.handleGetWallet(
    playerRepository: IPlayerRepository,
    drawPointTransactionRepository: IDrawPointTransactionRepository,
    revenuePointTransactionRepository: IRevenuePointTransactionRepository,
) {
    val principal = call.principal<PlayerPrincipal>()!!
    val player =
        playerRepository.findById(principal.playerId)
            ?: run {
                call.respond(HttpStatusCode.NotFound, mapOf("error" to "Player not found"))
                return
            }

    val drawTransactions =
        drawPointTransactionRepository
            .findByPlayer(principal.playerId, offset = 0, limit = WALLET_TX_PAGE_SIZE)
            .map { tx ->
                DrawPointTransactionDto(
                    id = tx.id.toString(),
                    type = tx.type,
                    amount = tx.amount,
                    balanceAfter = tx.balanceAfter,
                    description = tx.description,
                    createdAt = tx.createdAt,
                )
            }

    val revenueTransactions =
        revenuePointTransactionRepository
            .findByPlayer(principal.playerId, offset = 0, limit = WALLET_TX_PAGE_SIZE)
            .map { tx ->
                com.prizedraw.contracts.dto.player.RevenuePointTransactionDto(
                    id = tx.id.toString(),
                    type = tx.type,
                    amount = tx.amount,
                    balanceAfter = tx.balanceAfter,
                    description = tx.description,
                    createdAt = tx.createdAt,
                )
            }

    val wallet =
        WalletDto(
            drawPointsBalance = player.drawPointsBalance,
            revenuePointsBalance = player.revenuePointsBalance,
            drawTransactions = drawTransactions,
            revenueTransactions = revenueTransactions,
        )
    call.respond(HttpStatusCode.OK, wallet)
}

private suspend fun io.ktor.server.routing.RoutingContext.handleUpdateAnimationPreference(
    updateAnimationPreferenceUseCase: IUpdateAnimationPreferenceUseCase,
) {
    val principal = call.principal<PlayerPrincipal>()!!

    @Serializable
    data class AnimationPreferenceRequest(
        val mode: DrawAnimationMode,
    )
    val request = call.receive<AnimationPreferenceRequest>()
    try {
        val player = updateAnimationPreferenceUseCase.execute(principal.playerId, request.mode)
        call.respond(HttpStatusCode.OK, player)
    } catch (e: PlayerNotFoundException) {
        call.respond(HttpStatusCode.NotFound, mapOf("error" to e.message))
    }
}

private suspend fun io.ktor.server.routing.RoutingContext.handleGetPublicPrizes(
    prizeRepository: IPrizeRepository,
) {
    val rawId =
        call.parameters["playerId"] ?: run {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing playerId"))
            return
        }
    val playerId =
        runCatching { DomainPlayerId(UUID.fromString(rawId)) }.getOrElse {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid playerId"))
            return
        }
    val instances = prizeRepository.findInstancesByOwner(ownerId = playerId, state = PrizeState.HOLDING)
    val dtos =
        instances
            .filter { it.deletedAt == null }
            .mapNotNull { instance ->
                val definition =
                    prizeRepository.findDefinitionById(instance.prizeDefinitionId)
                        ?: return@mapNotNull null
                com.prizedraw.contracts.dto.prize.PrizeInstanceDto(
                    id = instance.id.value.toString(),
                    prizeDefinitionId = instance.prizeDefinitionId.value.toString(),
                    grade = definition.grade,
                    name = definition.name,
                    photoUrl = definition.photos.firstOrNull(),
                    state = instance.state,
                    acquisitionMethod = instance.acquisitionMethod.name,
                    acquiredAt = instance.acquiredAt,
                )
            }
    call.respond(HttpStatusCode.OK, dtos)
}

private const val WALLET_TX_PAGE_SIZE = 50
