package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.IGetFollowStatusUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import java.util.UUID

/**
 * Checks whether a follow relationship exists between two players.
 */
public class GetFollowStatusUseCase(
    private val followRepository: IFollowRepository,
) : IGetFollowStatusUseCase {
    override suspend fun execute(
        followerId: UUID,
        targetPlayerId: UUID,
    ): Boolean = followRepository.exists(followerId, targetPlayerId)
}
