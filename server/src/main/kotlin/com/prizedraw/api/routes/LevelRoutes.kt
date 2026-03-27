package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.output.IXpTransactionRepository
import com.prizedraw.application.services.LevelService
import com.prizedraw.contracts.dto.level.PlayerLevelDto
import com.prizedraw.contracts.dto.level.TierConfigDto
import com.prizedraw.contracts.dto.level.XpLeaderboardEntryDto
import com.prizedraw.contracts.dto.level.XpTransactionDto
import com.prizedraw.contracts.endpoints.LevelEndpoints
import com.prizedraw.contracts.endpoints.PlayerEndpoints
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import com.prizedraw.domain.valueobjects.PlayerId as DomainPlayerId

/**
 * Registers level, tier, XP history, and XP leaderboard routes.
 *
 * - GET [PlayerEndpoints.ME_LEVEL]      — authenticated player's current level info
 * - GET [PlayerEndpoints.ME_XP_HISTORY] — authenticated player's paginated XP transaction log
 * - GET [LevelEndpoints.TIERS]          — public tier reference data
 * - GET [LevelEndpoints.XP_LEADERBOARD] — top players by XP
 */
public fun Route.levelRoutes() {
    val levelService: LevelService by inject()
    val xpTransactionRepository: IXpTransactionRepository by inject()

    authenticate("player") {
        get(PlayerEndpoints.ME_LEVEL) {
            handleGetPlayerLevel(levelService)
        }

        get(PlayerEndpoints.ME_XP_HISTORY) {
            handleGetXpHistory(xpTransactionRepository)
        }
    }

    // Public — no auth required
    get(LevelEndpoints.TIERS) {
        handleGetTiers(levelService)
    }

    get(LevelEndpoints.XP_LEADERBOARD) {
        handleGetXpLeaderboard(levelService)
    }
}

private suspend fun RoutingContext.handleGetPlayerLevel(levelService: LevelService) {
    val principal = call.principal<PlayerPrincipal>()!!
    val playerId = DomainPlayerId(principal.playerId.value)
    runCatching { levelService.getPlayerLevel(playerId) }
        .onSuccess { info ->
            call.respond(
                HttpStatusCode.OK,
                PlayerLevelDto(
                    xp = info.xp,
                    level = info.level,
                    tier = info.tier,
                    tierDisplayName = info.tierConfig.displayName,
                    tierIcon = info.tierConfig.icon,
                    tierColor = info.tierConfig.color,
                    xpToNextLevel = info.xpToNextLevel,
                    xpProgress = info.xpProgress,
                    benefits = info.tierConfig.benefits.toStringMap(),
                ),
            )
        }.onFailure { ex ->
            call.respond(HttpStatusCode.InternalServerError, mapOf("error" to ex.message))
        }
}

private suspend fun RoutingContext.handleGetXpHistory(xpTransactionRepository: IXpTransactionRepository) {
    val principal = call.principal<PlayerPrincipal>()!!
    val playerId = DomainPlayerId(principal.playerId.value)
    val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
    val limit =
        (call.request.queryParameters["limit"]?.toIntOrNull() ?: XP_HISTORY_DEFAULT_LIMIT)
            .coerceAtMost(XP_HISTORY_MAX_LIMIT)
    val dtos =
        xpTransactionRepository.findByPlayer(playerId, offset, limit).map { tx ->
            XpTransactionDto(
                id = tx.id.toString(),
                amount = tx.amount,
                sourceType = tx.sourceType.name,
                description = tx.description,
                createdAt = tx.createdAt.toString(),
            )
        }
    call.respond(HttpStatusCode.OK, dtos)
}

private suspend fun RoutingContext.handleGetTiers(levelService: LevelService) {
    val dtos =
        levelService.getTierConfigs().map { config ->
            TierConfigDto(
                tier = config.tier,
                displayName = config.displayName,
                minXp = config.minXp,
                icon = config.icon,
                color = config.color,
                benefits = config.benefits.toStringMap(),
            )
        }
    call.respond(HttpStatusCode.OK, dtos)
}

private suspend fun RoutingContext.handleGetXpLeaderboard(levelService: LevelService) {
    val limit =
        (call.request.queryParameters["limit"]?.toIntOrNull() ?: XP_LEADERBOARD_DEFAULT_LIMIT)
            .coerceAtMost(XP_LEADERBOARD_MAX_LIMIT)
    val dtos =
        levelService.getXpLeaderboard(limit).map { entry ->
            XpLeaderboardEntryDto(
                rank = entry.rank,
                playerId = entry.playerId.toString(),
                nickname = entry.nickname,
                avatarUrl = entry.avatarUrl,
                xp = entry.xp,
                level = entry.level,
                tier = entry.tier,
            )
        }
    call.respond(HttpStatusCode.OK, dtos)
}

/**
 * Converts a [JsonObject] of tier benefits to a plain [Map]<[String], [String]>
 * suitable for serialisation in API response DTOs.
 */
private fun JsonObject.toStringMap(): Map<String, String> =
    entries.associate { (key, value) ->
        key to ((value as? JsonPrimitive)?.contentOrNull ?: value.toString())
    }

private const val XP_HISTORY_DEFAULT_LIMIT = 50
private const val XP_HISTORY_MAX_LIMIT = 200
private const val XP_LEADERBOARD_DEFAULT_LIMIT = 50
private const val XP_LEADERBOARD_MAX_LIMIT = 200
