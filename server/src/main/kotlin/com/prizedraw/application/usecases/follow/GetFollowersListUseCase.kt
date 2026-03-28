package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.IGetFollowersListUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.contracts.dto.follow.FollowListResponse
import com.prizedraw.contracts.dto.follow.FollowPlayerDto
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Returns a paginated list of players that follow a given player.
 *
 * Player entities are batch-loaded and follow-back status is resolved via a single
 * batch query to avoid N+1 database access. Each item's
 * [FollowPlayerDto.isFollowing] indicates whether [playerId] follows that follower back.
 */
public class GetFollowersListUseCase(
    private val followRepository: IFollowRepository,
    private val playerRepository: IPlayerRepository,
) : IGetFollowersListUseCase {
    override suspend fun execute(
        playerId: UUID,
        limit: Int,
        offset: Int,
    ): FollowListResponse {
        val follows = followRepository.findFollowers(playerId, limit, offset)
        val total = followRepository.countFollowers(playerId)

        val followerIds = follows.map { it.followerId }
        val playerIds = followerIds.map { PlayerId(it) }
        val playersById = playerRepository.findByIds(playerIds).associateBy { it.id.value }

        val followedBackSet = followRepository.existsBatch(playerId, followerIds)

        val items =
            follows.mapNotNull { follow ->
                val player = playersById[follow.followerId] ?: return@mapNotNull null
                FollowPlayerDto(
                    playerId = player.id.value.toString(),
                    nickname = player.nickname,
                    avatarUrl = player.avatarUrl,
                    playerCode = player.playerCode,
                    isFollowing = follow.followerId in followedBackSet,
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
