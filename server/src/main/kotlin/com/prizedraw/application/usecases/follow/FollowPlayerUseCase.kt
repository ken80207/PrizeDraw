package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.IFollowPlayerUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.domain.entities.Follow
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import java.util.UUID

/**
 * Creates a unidirectional follow relationship after validating preconditions.
 *
 * Validates that:
 * - The follower is not trying to follow themselves.
 * - The target player exists.
 * - The follow relationship does not already exist.
 */
public class FollowPlayerUseCase(
    private val followRepository: IFollowRepository,
    private val playerRepository: IPlayerRepository,
) : IFollowPlayerUseCase {
    override suspend fun execute(
        followerId: UUID,
        targetPlayerId: UUID,
    ) {
        require(followerId != targetPlayerId) { "Cannot follow yourself" }
        playerRepository.findById(PlayerId(targetPlayerId))
            ?: throw IllegalArgumentException("Target player not found")
        check(!followRepository.exists(followerId, targetPlayerId)) { "Already following this player" }
        followRepository.save(
            Follow(
                followerId = followerId,
                followingId = targetPlayerId,
                createdAt = Clock.System.now(),
            ),
        )
    }
}
