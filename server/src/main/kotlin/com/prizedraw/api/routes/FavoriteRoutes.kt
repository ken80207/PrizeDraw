package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.input.favorite.IAddFavoriteUseCase
import com.prizedraw.application.ports.input.favorite.IGetFavoritesUseCase
import com.prizedraw.application.ports.input.favorite.IRemoveFavoriteUseCase
import com.prizedraw.contracts.endpoints.FavoriteEndpoints
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.valueobjects.CampaignId
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.put
import java.util.UUID

/**
 * Registers player campaign favorites routes. All routes require JWT player authentication.
 *
 * - GET [FavoriteEndpoints.LIST]   — Paginated list of the authenticated player's favorited campaigns.
 * - PUT [FavoriteEndpoints.ADD]    — Add a campaign to favorites (idempotent, 204 No Content).
 * - DELETE [FavoriteEndpoints.REMOVE] — Remove a campaign from favorites (idempotent, 204 No Content).
 */
public fun Route.favoriteRoutes() {
    val getFavoritesUseCase: IGetFavoritesUseCase by inject()
    val addFavoriteUseCase: IAddFavoriteUseCase by inject()
    val removeFavoriteUseCase: IRemoveFavoriteUseCase by inject()

    authenticate("player") {
        get(FavoriteEndpoints.LIST) {
            val principal = call.principal<PlayerPrincipal>()!!

            val typeParam = call.request.queryParameters["type"]
            val campaignType =
                typeParam?.let {
                    runCatching { CampaignType.valueOf(it.uppercase()) }.getOrElse {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid campaign type: $it"))
                        return@get
                    }
                }

            val page =
                call.request.queryParameters["page"]
                    ?.toIntOrNull()
                    ?.coerceAtLeast(1) ?: 1
            val size =
                call.request.queryParameters["size"]
                    ?.toIntOrNull()
                    ?.coerceIn(1, 100) ?: 20

            val result =
                getFavoritesUseCase.execute(
                    playerId = principal.playerId,
                    campaignType = campaignType,
                    page = page,
                    size = size,
                )
            call.respond(HttpStatusCode.OK, result)
        }

        put(FavoriteEndpoints.ADD) {
            val principal = call.principal<PlayerPrincipal>()!!

            val campaignType = parseCampaignTypeParam() ?: return@put
            val campaignId = parseCampaignIdParam() ?: return@put

            try {
                addFavoriteUseCase.execute(
                    playerId = principal.playerId,
                    campaignType = campaignType,
                    campaignId = CampaignId(campaignId),
                )
                call.respond(HttpStatusCode.NoContent)
            } catch (e: IllegalArgumentException) {
                call.respond(HttpStatusCode.NotFound, mapOf("error" to (e.message ?: "Campaign not found")))
            }
        }

        delete(FavoriteEndpoints.REMOVE) {
            val principal = call.principal<PlayerPrincipal>()!!

            val campaignType = parseCampaignTypeParam() ?: return@delete
            val campaignId = parseCampaignIdParam() ?: return@delete

            removeFavoriteUseCase.execute(
                playerId = principal.playerId,
                campaignType = campaignType,
                campaignId = CampaignId(campaignId),
            )
            call.respond(HttpStatusCode.NoContent)
        }
    }
}

private suspend fun io.ktor.server.routing.RoutingContext.parseCampaignTypeParam(): CampaignType? {
    val raw =
        call.parameters["campaignType"] ?: run {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing campaignType"))
            return null
        }
    return runCatching { CampaignType.valueOf(raw.uppercase()) }.getOrElse {
        call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid campaignType: $raw"))
        null
    }
}

private suspend fun io.ktor.server.routing.RoutingContext.parseCampaignIdParam(): UUID? {
    val raw =
        call.parameters["campaignId"] ?: run {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing campaignId"))
            return null
        }
    return runCatching { UUID.fromString(raw) }.getOrElse {
        call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid campaignId"))
        null
    }
}
