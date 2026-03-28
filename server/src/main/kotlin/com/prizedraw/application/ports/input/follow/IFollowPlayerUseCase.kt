package com.prizedraw.application.ports.input.follow

import java.util.UUID

/**
 * Input port for following another player.
 *
 * A player cannot follow themselves. Attempting to follow a player that does
 * not exist or is already followed raises an exception.
 */
public interface IFollowPlayerUseCase {
    /**
     * Makes [followerId] follow [targetPlayerId].
     *
     * @param followerId The player initiating the follow.
     * @param targetPlayerId The player being followed.
     * @throws IllegalArgumentException if [followerId] equals [targetPlayerId] or the target does not exist.
     * @throws IllegalStateException if the follow relationship already exists.
     */
    public suspend fun execute(
        followerId: UUID,
        targetPlayerId: UUID,
    )
}
