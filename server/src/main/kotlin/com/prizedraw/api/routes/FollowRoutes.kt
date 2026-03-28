package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.input.follow.IBatchFollowStatusUseCase
import com.prizedraw.application.ports.input.follow.IFollowPlayerUseCase
import com.prizedraw.application.ports.input.follow.IGetFollowStatusUseCase
import com.prizedraw.application.ports.input.follow.IGetFollowersListUseCase
import com.prizedraw.application.ports.input.follow.IGetFollowingListUseCase
import com.prizedraw.application.ports.input.follow.ISearchPlayerByCodeUseCase
import com.prizedraw.application.ports.input.follow.IUnfollowPlayerUseCase
import com.prizedraw.contracts.dto.follow.BatchFollowStatusRequest
import com.prizedraw.contracts.dto.follow.BatchFollowStatusResponse
import com.prizedraw.contracts.dto.follow.FollowStatusResponse
import com.prizedraw.contracts.dto.follow.PlayerSearchResponse
import com.prizedraw.contracts.endpoints.FollowEndpoints
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.post
import java.util.UUID

private const val PAGINATION_LIMIT_DEFAULT = 20
private const val PAGINATION_LIMIT_MIN = 1
private const val PAGINATION_LIMIT_MAX = 50
private const val PAGINATION_OFFSET_MIN = 0

/**
 * Registers all follow system HTTP routes. All routes require JWT player authentication.
 *
 * - POST   [FollowEndpoints.FOLLOW]             — Follow a player (201 Created).
 * - DELETE [FollowEndpoints.FOLLOW]             — Unfollow a player (204 No Content, idempotent).
 * - GET [FollowEndpoints.FOLLOWING_LIST]      — Paginated list of players the caller follows.
 * - GET [FollowEndpoints.FOLLOWERS_LIST]      — Paginated list of players who follow the caller.
 * - GET [FollowEndpoints.FOLLOW_STATUS]       — Check whether the caller follows a given player.
 * - POST   [FollowEndpoints.BATCH_FOLLOW_STATUS] — Batch check follow status for multiple players.
 * - GET [FollowEndpoints.SEARCH_BY_CODE]      — Search for a player by their unique player code.
 */
public fun Route.followRoutes() {
    val followPlayerUseCase: IFollowPlayerUseCase by inject()
    val unfollowPlayerUseCase: IUnfollowPlayerUseCase by inject()
    val getFollowingListUseCase: IGetFollowingListUseCase by inject()
    val getFollowersListUseCase: IGetFollowersListUseCase by inject()
    val getFollowStatusUseCase: IGetFollowStatusUseCase by inject()
    val searchPlayerByCodeUseCase: ISearchPlayerByCodeUseCase by inject()
    val batchFollowStatusUseCase: IBatchFollowStatusUseCase by inject()

    authenticate("player") {
        post(FollowEndpoints.FOLLOW) { handleFollow(followPlayerUseCase) }
        delete(FollowEndpoints.FOLLOW) { handleUnfollow(unfollowPlayerUseCase) }
        get(FollowEndpoints.FOLLOWING_LIST) { handleGetFollowing(getFollowingListUseCase) }
        get(FollowEndpoints.FOLLOWERS_LIST) { handleGetFollowers(getFollowersListUseCase) }
        get(FollowEndpoints.FOLLOW_STATUS) { handleGetFollowStatus(getFollowStatusUseCase) }
        post(FollowEndpoints.BATCH_FOLLOW_STATUS) { handleBatchFollowStatus(batchFollowStatusUseCase) }
        get(FollowEndpoints.SEARCH_BY_CODE) { handleSearchByCode(searchPlayerByCodeUseCase) }
    }
}

private suspend fun RoutingContext.handleFollow(useCase: IFollowPlayerUseCase) {
    val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
    val targetPlayerId = parsePlayerIdPathParam() ?: return

    try {
        useCase.execute(followerId = principal.playerId.value, targetPlayerId = targetPlayerId)
        call.respond(HttpStatusCode.Created)
    } catch (e: IllegalArgumentException) {
        if (e.message?.contains("yourself", ignoreCase = true) == true) {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to (e.message ?: "Cannot follow yourself")))
        } else {
            call.respond(HttpStatusCode.NotFound, mapOf("error" to (e.message ?: "Player not found")))
        }
    } catch (e: IllegalStateException) {
        call.respond(HttpStatusCode.Conflict, mapOf("error" to (e.message ?: "Already following")))
    }
}

private suspend fun RoutingContext.handleUnfollow(useCase: IUnfollowPlayerUseCase) {
    val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
    val targetPlayerId = parsePlayerIdPathParam() ?: return

    useCase.execute(followerId = principal.playerId.value, targetPlayerId = targetPlayerId)
    call.respond(HttpStatusCode.NoContent)
}

private suspend fun RoutingContext.handleGetFollowing(useCase: IGetFollowingListUseCase) {
    val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
    val (limit, offset) = parsePaginationParams()

    val result = useCase.execute(playerId = principal.playerId.value, limit = limit, offset = offset)
    call.respond(HttpStatusCode.OK, result)
}

private suspend fun RoutingContext.handleGetFollowers(useCase: IGetFollowersListUseCase) {
    val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
    val (limit, offset) = parsePaginationParams()

    val result = useCase.execute(playerId = principal.playerId.value, limit = limit, offset = offset)
    call.respond(HttpStatusCode.OK, result)
}

private suspend fun RoutingContext.handleGetFollowStatus(useCase: IGetFollowStatusUseCase) {
    val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
    val targetPlayerId = parsePlayerIdPathParam() ?: return

    val isFollowing = useCase.execute(followerId = principal.playerId.value, targetPlayerId = targetPlayerId)
    call.respond(HttpStatusCode.OK, FollowStatusResponse(isFollowing = isFollowing))
}

private suspend fun RoutingContext.handleBatchFollowStatus(useCase: IBatchFollowStatusUseCase) {
    val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
    val request = call.receive<BatchFollowStatusRequest>()

    val targetUuids = request.playerIds.mapNotNull { runCatching { UUID.fromString(it) }.getOrNull() }
    val statusMap = useCase.execute(followerId = principal.playerId.value, targetPlayerIds = targetUuids)

    val response =
        BatchFollowStatusResponse(
            statuses = statusMap.entries.associate { (uuid, status) -> uuid.toString() to status },
        )
    call.respond(HttpStatusCode.OK, response)
}

private suspend fun RoutingContext.handleSearchByCode(useCase: ISearchPlayerByCodeUseCase) {
    val principal = call.principal<PlayerPrincipal>() ?: error("Missing principal")
    val code =
        call.request.queryParameters["code"] ?: run {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing query parameter: code"))
            return
        }

    val player = useCase.execute(requesterId = principal.playerId.value, code = code)
    call.respond(HttpStatusCode.OK, PlayerSearchResponse(player = player))
}

private fun RoutingContext.parsePaginationParams(): Pair<Int, Int> {
    val limit =
        call.request.queryParameters["limit"]
            ?.toIntOrNull()
            ?.coerceIn(PAGINATION_LIMIT_MIN, PAGINATION_LIMIT_MAX)
            ?: PAGINATION_LIMIT_DEFAULT
    val offset =
        call.request.queryParameters["offset"]
            ?.toIntOrNull()
            ?.coerceAtLeast(PAGINATION_OFFSET_MIN)
            ?: PAGINATION_OFFSET_MIN
    return limit to offset
}

private suspend fun RoutingContext.parsePlayerIdPathParam(): UUID? {
    val raw =
        call.parameters["playerId"] ?: run {
            call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing path parameter: playerId"))
            return null
        }
    return runCatching { UUID.fromString(raw) }.getOrElse {
        call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid playerId: $raw"))
        null
    }
}
