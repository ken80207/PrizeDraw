package com.prizedraw.notification.ports

import java.util.UUID

/**
 * Output port for follow relationship queries used during notification fan-out.
 */
public interface IFollowRepository {
    /**
     * Returns (followId, followerId) pairs in cursor-based batches for notification fan-out.
     *
     * Used by [OutboxWorker] to fan out following events to all followers of a player
     * without loading all follower IDs into memory at once.
     *
     * @param followingId The player whose followers to query.
     * @param afterFollowId Cursor — return only rows with id greater than this value, or all rows if null.
     * @param limit Maximum number of pairs to return.
     * @return List of (followId, followerId) pairs ordered by followId ascending.
     */
    public suspend fun findFollowerIdsBatch(
        followingId: UUID,
        afterFollowId: UUID?,
        limit: Int,
    ): List<Pair<UUID, UUID>>
}
