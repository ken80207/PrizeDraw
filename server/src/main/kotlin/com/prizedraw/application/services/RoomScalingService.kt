package com.prizedraw.application.services

import com.prizedraw.application.ports.output.IRoomInstanceRepository
import com.prizedraw.domain.entities.RoomInstance
import com.prizedraw.infrastructure.external.redis.RedisClient
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import kotlinx.datetime.Clock
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Domain stats aggregated across all active room shards for a campaign.
 *
 * Returned by [RoomScalingService.getCampaignStats] and also sent to all
 * connected clients as an [S2C_ROOM_STATS] WebSocket event.
 *
 * @param totalViewers Sum of [RoomInstance.playerCount] across all active shards.
 * @param activeRooms Number of active shards.
 * @param totalInQueue Players currently waiting in the draw queue for this campaign.
 */
public data class CampaignViewerStats(
    val totalViewers: Int,
    val activeRooms: Int,
    val totalInQueue: Int,
)

/**
 * Application service responsible for automatic room sharding.
 *
 * When a campaign is popular, a single WebSocket room cannot accommodate all
 * concurrent viewers. This service assigns each connecting player to the
 * least-loaded shard that is below [SCALE_UP_THRESHOLD], creating a new
 * shard on demand when all existing ones are near capacity.
 *
 * ### Rendering notes (frontend contract)
 * - Each shard shows at most 20 character models (nearest by virtual distance).
 * - Players beyond the visible 20 are rendered as dots on a minimap overlay.
 * - The global viewer count is always displayed: e.g. "1,234 人在線".
 * - Chat throttling: the UI renders at most 5 messages per second per shard.
 * - Reactions with the same emoji are aggregated: "x23" instead of 23 bubbles.
 *
 * @param roomInstanceRepository Persistence for room shard state.
 * @param redisClient Redis command client (reserved for future Redis-backed counters).
 * @param redisPubSub Pub/sub bus for cross-pod room lifecycle events.
 */
public class RoomScalingService(
    private val roomInstanceRepository: IRoomInstanceRepository,
    @Suppress("UnusedPrivateProperty")
    private val redisClient: RedisClient,
    private val redisPubSub: RedisPubSub,
) {
    private val log = LoggerFactory.getLogger(RoomScalingService::class.java)

    /**
     * Assigns a connecting player to the best available shard for [campaignId].
     *
     * Strategy:
     * 1. Load all active shards for the campaign.
     * 2. Among shards below [SCALE_UP_THRESHOLD] capacity, pick the one with the
     *    fewest current players (load-balancing toward equal distribution).
     * 3. If no shard has headroom, create a new shard with [instanceNumber] = max + 1.
     * 4. Atomically increment the chosen shard's player count.
     * 5. Notify all pods via Redis pub/sub that a new shard was created (step 3 only).
     *
     * @param campaignId The campaign the player is joining.
     * @param playerId The player being assigned (used for logging / future pinning).
     * @return The shard the player should connect to.
     */
    public suspend fun assignRoom(
        campaignId: UUID,
        playerId: UUID,
    ): RoomInstance {
        val rooms = roomInstanceRepository.findActiveByCampaign(campaignId)

        val availableRoom =
            rooms
                .filter { it.playerCount < it.maxPlayers * SCALE_UP_THRESHOLD }
                .minByOrNull { it.playerCount }

        if (availableRoom != null) {
            roomInstanceRepository.incrementPlayerCount(availableRoom.id)
            log.debug(
                "Player {} assigned to existing shard {} (instance #{}) for campaign {}; " +
                    "count after increment: ~{}",
                playerId,
                availableRoom.id,
                availableRoom.instanceNumber,
                campaignId,
                availableRoom.playerCount + 1,
            )
            return availableRoom
        }

        // All shards are at or above threshold — provision a new shard.
        val nextInstanceNumber = (rooms.maxOfOrNull { it.instanceNumber } ?: 0) + 1
        val now = Clock.System.now()
        val newInstance =
            RoomInstance(
                id = UUID.randomUUID(),
                campaignId = campaignId,
                instanceNumber = nextInstanceNumber,
                playerCount = 1,
                maxPlayers = DEFAULT_MAX_PLAYERS,
                isActive = true,
                createdAt = now,
                updatedAt = now,
            )
        roomInstanceRepository.save(newInstance)

        // Publish lifecycle event so all server pods can update their local state.
        redisPubSub.publish(
            "campaign:$campaignId:rooms",
            """{"event":"ROOM_CREATED","instanceNumber":$nextInstanceNumber,"roomInstanceId":"${newInstance.id}"}""",
        )

        log.info(
            "Created new shard #{} ({}) for campaign {} — previous shard count: {}",
            nextInstanceNumber,
            newInstance.id,
            campaignId,
            rooms.size,
        )
        return newInstance
    }

    /**
     * Records that a player has left a shard.
     *
     * Decrements the player count atomically. The shard is not immediately
     * deactivated; [cleanupEmptyRooms] handles deactivation after a grace period.
     *
     * @param roomInstanceId The shard the player is leaving.
     */
    public suspend fun leaveRoom(roomInstanceId: UUID) {
        roomInstanceRepository.decrementPlayerCount(roomInstanceId)
        log.debug("Player left shard {}", roomInstanceId)
    }

    /**
     * Returns all active shards for [campaignId], ordered by instance number.
     *
     * Used by the REST endpoint `GET /api/v1/campaigns/kuji/{campaignId}/rooms` so
     * clients can enumerate shards and pick one before connecting via WebSocket.
     *
     * @param campaignId The campaign whose active shards are listed.
     */
    public suspend fun listActiveRooms(campaignId: UUID): List<RoomInstance> =
        roomInstanceRepository.findActiveByCampaign(campaignId)

    /**
     * Returns the aggregated viewer stats for [campaignId] across all active shards.
     *
     * The returned [CampaignViewerStats] is suitable for broadcasting as an
     * [S2C_ROOM_STATS] WebSocket event to all connected clients.
     *
     * @param campaignId The campaign to aggregate stats for.
     */
    public suspend fun getCampaignStats(campaignId: UUID): CampaignViewerStats {
        val rooms = roomInstanceRepository.findActiveByCampaign(campaignId)
        return CampaignViewerStats(
            totalViewers = rooms.sumOf { it.playerCount },
            activeRooms = rooms.size,
            totalInQueue = 0, // Aggregated from QueueService in a future iteration.
        )
    }

    /**
     * Looks up a specific shard by its primary key, or `null` if not found.
     *
     * Used by the sharded WebSocket endpoint to validate the client-supplied
     * `roomInstanceId` path parameter.
     *
     * @param roomInstanceId The shard UUID supplied by the client.
     * @return The shard, or `null` if it does not exist or is inactive.
     */
    public suspend fun findShard(roomInstanceId: UUID): RoomInstance? =
        roomInstanceRepository.findById(roomInstanceId)?.takeIf { it.isActive }

    /**
     * Directly increments the player count for a known shard.
     *
     * Used by the sharded WebSocket endpoint where the shard is pre-selected by
     * the client rather than auto-assigned. The caller must have already verified
     * the shard is active and below capacity.
     *
     * @param roomInstanceId The shard to increment.
     */
    public suspend fun incrementShardCount(roomInstanceId: UUID) {
        roomInstanceRepository.incrementPlayerCount(roomInstanceId)
    }

    /**
     * Deactivates empty shards that have had zero players for at least 5 minutes,
     * while preserving at least one active shard per campaign.
     *
     * Intended to be called periodically (every 2 minutes) from the application
     * startup cleanup coroutine.
     */
    public suspend fun cleanupEmptyRooms() {
        roomInstanceRepository.deactivateEmptyRooms(
            emptyForMinutes = CLEANUP_GRACE_MINUTES,
            keepMinimum = MINIMUM_SHARDS_PER_CAMPAIGN,
        )
        log.debug("Room cleanup cycle complete")
    }

    public companion object {
        /** Default shard capacity. */
        public const val DEFAULT_MAX_PLAYERS: Int = 30

        /**
         * Fraction of [DEFAULT_MAX_PLAYERS] at which a new shard is provisioned.
         *
         * At 85% capacity (26 of 30 players) the next connection triggers a new shard
         * rather than filling the current one to the brim. This provides headroom so
         * that a burst of connections does not temporarily overfill a shard while the
         * new one is being created.
         */
        public const val SCALE_UP_THRESHOLD: Double = 0.85

        private const val CLEANUP_GRACE_MINUTES = 5
        private const val MINIMUM_SHARDS_PER_CAMPAIGN = 1
    }
}
