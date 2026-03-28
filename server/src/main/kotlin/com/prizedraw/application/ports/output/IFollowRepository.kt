package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.Follow
import java.util.UUID

/**
 * Output port for follow relationship persistence.
 */
@Suppress("TooManyFunctions")
public interface IFollowRepository {
    /** Creates a follow relationship. Returns the created Follow. */
    public suspend fun save(follow: Follow): Follow

    /** Deletes a follow relationship. Returns true if a row was deleted. */
    public suspend fun delete(
        followerId: UUID,
        followingId: UUID,
    ): Boolean

    /** Checks if a follow relationship exists. */
    public suspend fun exists(
        followerId: UUID,
        followingId: UUID,
    ): Boolean

    /** Checks follow status for multiple target players at once. Returns set of followed player IDs. */
    public suspend fun existsBatch(
        followerId: UUID,
        followingIds: List<UUID>,
    ): Set<UUID>

    /** Returns paginated list of players that [followerId] follows, newest first. */
    public suspend fun findFollowing(
        followerId: UUID,
        limit: Int,
        offset: Int,
    ): List<Follow>

    /** Returns paginated list of players that follow [followingId], newest first. */
    public suspend fun findFollowers(
        followingId: UUID,
        limit: Int,
        offset: Int,
    ): List<Follow>

    /** Count of players that [playerId] follows. */
    public suspend fun countFollowing(playerId: UUID): Int

    /** Count of players that follow [playerId]. */
    public suspend fun countFollowers(playerId: UUID): Int

    /** Returns (followId, followerId) pairs in batches for notification fan-out. Cursor-based via followId. */
    public suspend fun findFollowerIdsBatch(
        followingId: UUID,
        afterFollowId: UUID?,
        limit: Int,
    ): List<Pair<UUID, UUID>>
}
