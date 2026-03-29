package com.prizedraw.realtime.ports

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
     * Opens its own transaction. Use [findActiveByCampaignTx] when already inside a transaction.
     *
     * @param campaignId The campaign whose shards are queried.
     */
    public suspend fun findActiveByCampaign(campaignId: UUID): List<RoomInstance>

    /**
     * Returns all active shards for [campaignId] within the **caller's existing transaction**.
     *
     * Must be called from within a [org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction]
     * block. Used by [com.prizedraw.realtime.services.RoomScalingService.assignRoom] to avoid
     * opening a nested transaction after the advisory lock has been acquired.
     *
     * @param campaignId The campaign whose shards are queried.
     */
    public suspend fun findActiveByCampaignTx(campaignId: UUID): List<RoomInstance>

    /**
     * Finds a shard by its primary key, or `null` if not found.
     *
     * @param id The shard UUID.
     */
    public suspend fun findById(id: UUID): RoomInstance?

    /**
     * Persists a new shard (insert only — shards are never updated wholesale).
     *
     * Opens its own transaction. Use [saveTx] when already inside a transaction.
     *
     * @param instance The shard to insert.
     * @return The persisted shard, identical to the input for newly inserted rows.
     */
    public suspend fun save(instance: RoomInstance): RoomInstance

    /**
     * Persists a new shard within the **caller's existing transaction**.
     *
     * @param instance The shard to insert.
     * @return The persisted shard, identical to the input for newly inserted rows.
     */
    public suspend fun saveTx(instance: RoomInstance): RoomInstance

    /**
     * Atomically increments the player count for the given shard by 1.
     *
     * Opens its own transaction. Use [incrementPlayerCountTx] when already inside a transaction.
     *
     * @param instanceId The shard whose player count is incremented.
     */
    public suspend fun incrementPlayerCount(instanceId: UUID)

    /**
     * Atomically increments the player count within the **caller's existing transaction**.
     *
     * @param instanceId The shard whose player count is incremented.
     */
    public suspend fun incrementPlayerCountTx(instanceId: UUID)

    /**
     * Atomically decrements the player count for the given shard by 1, floor at 0.
     *
     * @param instanceId The shard whose player count is decremented.
     */
    public suspend fun decrementPlayerCount(instanceId: UUID)

    /**
     * Marks shards as inactive when they have been empty for at least [emptyForMinutes] minutes,
     * keeping a minimum of [keepMinimum] active shards per campaign.
     *
     * @param emptyForMinutes Grace period before an empty shard is deactivated.
     * @param keepMinimum Minimum number of active shards preserved per campaign regardless of emptiness.
     */
    public suspend fun deactivateEmptyRooms(
        emptyForMinutes: Int,
        keepMinimum: Int,
    )
}
