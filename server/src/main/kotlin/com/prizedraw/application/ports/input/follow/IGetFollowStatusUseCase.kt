package com.prizedraw.application.ports.input.follow

import java.util.UUID

/**
 * Input port for checking whether one player follows another.
 */
public interface IGetFollowStatusUseCase {
    /**
     * Returns true if [followerId] currently follows [targetPlayerId].
     *
     * @param followerId The player whose follow status to check.
     * @param targetPlayerId The target player.
     * @return True if the follow relationship exists, false otherwise.
     */
    public suspend fun execute(
        followerId: UUID,
        targetPlayerId: UUID,
    ): Boolean
}
