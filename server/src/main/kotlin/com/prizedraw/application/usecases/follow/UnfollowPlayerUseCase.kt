package com.prizedraw.application.usecases.follow

import com.prizedraw.application.ports.input.follow.IUnfollowPlayerUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import java.util.UUID

/**
 * Removes an existing follow relationship.
 *
 * The operation is idempotent: if the relationship does not exist the repository
 * returns false and no error is raised.
 */
public class UnfollowPlayerUseCase(
    private val followRepository: IFollowRepository,
) : IUnfollowPlayerUseCase {
    override suspend fun execute(
        followerId: UUID,
        targetPlayerId: UUID,
    ) {
        followRepository.delete(followerId, targetPlayerId)
    }
}
