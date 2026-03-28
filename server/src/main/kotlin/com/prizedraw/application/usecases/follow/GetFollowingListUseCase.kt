package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.IGetFollowingListUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.contracts.dto.follow.FollowListResponse
import com.prizedraw.contracts.dto.follow.FollowPlayerDto
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Returns a paginated list of players that a given player follows.
 *
 * Player entities are batch-loaded to avoid N+1 database access. All items
 * have [FollowPlayerDto.isFollowing] set to true because the viewer is looking
 * at their own following list.
 */
public class GetFollowingListUseCase(
    private val followRepository: IFollowRepository,
    private val playerRepository: IPlayerRepository,
) : IGetFollowingListUseCase {
    override suspend fun execute(
        playerId: UUID,
        limit: Int,
        offset: Int,
    ): FollowListResponse {
        val follows = followRepository.findFollowing(playerId, limit, offset)
        val total = followRepository.countFollowing(playerId)

        val playerIds = follows.map { PlayerId(it.followingId) }
        val playersById = playerRepository.findByIds(playerIds).associateBy { it.id.value }

        val items =
            follows.mapNotNull { follow ->
                val player = playersById[follow.followingId] ?: return@mapNotNull null
                FollowPlayerDto(
                    playerId = player.id.value.toString(),
                    nickname = player.nickname,
                    avatarUrl = player.avatarUrl,
                    playerCode = player.playerCode,
                    isFollowing = true,
                )
            }

        return FollowListResponse(
            items = items,
            total = total,
            limit = limit,
            offset = offset,
        )
    }
}
