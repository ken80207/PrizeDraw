package com.prizedraw.application.ports.input.follow

import java.util.UUID

/**
 * Input port for checking follow status against multiple target players in a single call.
 *
 * Avoids N+1 queries when a screen needs to render follow buttons for a list of players.
 */
public interface IBatchFollowStatusUseCase {
    /**
     * Returns a map of target player ID to follow status for [followerId].
     *
     * @param followerId The player whose follow relationships are being checked.
     * @param targetPlayerIds The list of player IDs to check against.
     * @return A map where each entry's value is true if [followerId] follows that player.
     */
    public suspend fun execute(
        followerId: UUID,
        targetPlayerIds: List<UUID>,
    ): Map<UUID, Boolean>
}
