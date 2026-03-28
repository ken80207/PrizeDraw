package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.ISearchPlayerByCodeUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.contracts.dto.follow.FollowPlayerDto
import java.util.UUID

/**
 * Finds a player by their unique player code and enriches the result with follow status.
 *
 * The player code lookup is case-insensitive: the input [code] is upper-cased before querying.
 */
public class SearchPlayerByCodeUseCase(
    private val playerRepository: IPlayerRepository,
    private val followRepository: IFollowRepository,
) : ISearchPlayerByCodeUseCase {
    override suspend fun execute(
        requesterId: UUID,
        code: String,
    ): FollowPlayerDto? {
        val player = playerRepository.findByPlayerCode(code.uppercase()) ?: return null
        val isFollowing = followRepository.exists(requesterId, player.id.value)
        return FollowPlayerDto(
            playerId = player.id.value.toString(),
            nickname = player.nickname,
            avatarUrl = player.avatarUrl,
            playerCode = player.playerCode,
            isFollowing = isFollowing,
        )
    }
}
