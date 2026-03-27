package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.RoomInstance
import java.util.UUID

/**
 * Output port for persisting and querying [RoomInstance] shards.
 *
 * All operations run inside [org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction]
 * in the infrastructure implementation.
 */
public interface IRoomInstanceRepository {
    /**
     * Returns all active shards for [campaignId], ordered by [RoomInstance.instanceNumber].
     *
     * @param campaignId The campaign whose shards are queried.
     */
    public suspend fun findActiveByCampaign(campaignId: UUID): List<RoomInstance>

    /**
     * Finds a shard by its primary key, or `null` if not found.
     *
     * @param id The shard UUID.
     */
    public suspend fun findById(id: UUID): RoomInstance?

    /**
     * Persists a new shard (insert only — shards are never updated wholesale).
     *
     * @param instance The shard to insert.
     * @return The persisted shard, identical to the input for newly inserted rows.
     */
    public suspend fun save(instance: RoomInstance): RoomInstance

    /**
     * Atomically increments the player count for the given shard by 1.
     *
     * Uses a database-level `UPDATE … SET player_count = player_count + 1` to avoid
     * lost-update races under concurrent connection storms.
     *
     * @param instanceId The shard whose player count is incremented.
     */
    public suspend fun incrementPlayerCount(instanceId: UUID)

    /**
     * Atomically decrements the player count for the given shard by 1, floor at 0.
     *
     * @param instanceId The shard whose player count is decremented.
     */
    public suspend fun decrementPlayerCount(instanceId: UUID)

    /**
     * Marks shards as inactive when they have been empty for at least [emptyForMinutes] minutes,
     * keeping a minimum of [keepMinimum] active shards per campaign to avoid orphaned campaigns.
     *
     * @param emptyForMinutes Grace period before an empty shard is deactivated.
     * @param keepMinimum Minimum number of active shards preserved per campaign regardless of emptiness.
     */
    public suspend fun deactivateEmptyRooms(
        emptyForMinutes: Int,
        keepMinimum: Int,
    )

    /**
     * Upserts the global viewer stats for [campaignId] in `campaign_viewer_stats`.
     *
     * @param campaignId The campaign whose aggregate stats are updated.
     * @param totalViewers Sum of player counts across all active shards.
     * @param totalInQueue Number of players currently waiting in the draw queue.
     */
    public suspend fun updateViewerStats(
        campaignId: UUID,
        totalViewers: Int,
        totalInQueue: Int,
    )
}
