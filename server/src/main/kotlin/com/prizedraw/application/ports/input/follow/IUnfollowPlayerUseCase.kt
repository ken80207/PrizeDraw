package com.prizedraw.application.ports.input.follow

import java.util.UUID

/**
 * Input port for unfollowing a player.
 *
 * The operation is idempotent: if the follow relationship does not exist the call is a no-op.
 */
public interface IUnfollowPlayerUseCase {
    /**
     * Removes the follow relationship where [followerId] follows [targetPlayerId].
     *
     * @param followerId The player performing the unfollow.
     * @param targetPlayerId The player to unfollow.
     */
    public suspend fun execute(
        followerId: UUID,
        targetPlayerId: UUID,
    )
}
