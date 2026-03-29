package com.prizedraw.realtime.services

import com.prizedraw.domain.entities.RoomInstance
import com.prizedraw.realtime.infrastructure.redis.RedisClient
import com.prizedraw.realtime.infrastructure.redis.RedisPubSub
import com.prizedraw.realtime.ports.IRoomInstanceRepository
import kotlinx.datetime.Clock
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Domain stats aggregated across all active room shards for a campaign.
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
     * 2. Among shards below [SCALE_UP_THRESHOLD] capacity, pick the one with the fewest players.
     * 3. If no shard has headroom, create a new shard.
     * 4. Atomically increment the chosen shard's player count.
     * 5. Notify all pods via Redis pub/sub when a new shard is created.
     *
     * @param campaignId The campaign the player is joining.
     * @param playerId The player being assigned (used for logging).
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
                "Player {} assigned to existing shard {} (instance #{}) for campaign {}",
                playerId,
                availableRoom.id,
                availableRoom.instanceNumber,
                campaignId,
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
     * @param roomInstanceId The shard the player is leaving.
     */
    public suspend fun leaveRoom(roomInstanceId: UUID) {
        roomInstanceRepository.decrementPlayerCount(roomInstanceId)
        log.debug("Player left shard {}", roomInstanceId)
    }

    /**
     * Returns all active shards for [campaignId], ordered by instance number.
     *
     * @param campaignId The campaign whose active shards are listed.
     */
    public suspend fun listActiveRooms(campaignId: UUID): List<RoomInstance> =
        roomInstanceRepository.findActiveByCampaign(campaignId)

    /**
     * Returns the aggregated viewer stats for [campaignId] across all active shards.
     *
     * @param campaignId The campaign to aggregate stats for.
     */
    public suspend fun getCampaignStats(campaignId: UUID): CampaignViewerStats {
        val rooms = roomInstanceRepository.findActiveByCampaign(campaignId)
        return CampaignViewerStats(
            totalViewers = rooms.sumOf { it.playerCount },
            activeRooms = rooms.size,
            totalInQueue = 0,
        )
    }

    /**
     * Looks up a specific shard by its primary key, or `null` if not found or inactive.
     *
     * @param roomInstanceId The shard UUID supplied by the client.
     */
    public suspend fun findShard(roomInstanceId: UUID): RoomInstance? =
        roomInstanceRepository.findById(roomInstanceId)?.takeIf { it.isActive }

    /**
     * Directly increments the player count for a known shard.
     *
     * @param roomInstanceId The shard to increment.
     */
    public suspend fun incrementShardCount(roomInstanceId: UUID) {
        roomInstanceRepository.incrementPlayerCount(roomInstanceId)
    }

    /**
     * Deactivates empty shards that have had zero players for at least 5 minutes,
     * while preserving at least one active shard per campaign.
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
         * At 85% capacity (26 of 30 players) the next connection triggers a new shard.
         */
        public const val SCALE_UP_THRESHOLD: Double = 0.85

        private const val CLEANUP_GRACE_MINUTES = 5
        private const val MINIMUM_SHARDS_PER_CAMPAIGN = 1
    }
}
