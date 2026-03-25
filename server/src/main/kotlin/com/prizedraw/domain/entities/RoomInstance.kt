package com.prizedraw.domain.entities

import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A single WebSocket room shard for a campaign.
 *
 * When a campaign exceeds the scale-up threshold (85% of [maxPlayers]), a new
 * [RoomInstance] is created by [com.prizedraw.application.services.RoomScalingService].
 * Draw events broadcast globally across all instances for a campaign; chat messages
 * are scoped to a single instance.
 *
 * @param id Unique shard identifier. Clients connect to `/ws/kuji/{campaignId}/{id}`.
 * @param campaignId The parent campaign this shard belongs to.
 * @param instanceNumber Monotonically increasing shard index within the campaign (1, 2, 3 …).
 * @param playerCount Current number of connected players in this shard.
 * @param maxPlayers Capacity ceiling before a new shard is created. Defaults to 30.
 * @param isActive Whether this shard accepts new connections.
 * @param createdAt UTC timestamp of shard creation.
 * @param updatedAt UTC timestamp of the most recent player-count update.
 */
public data class RoomInstance(
    val id: UUID,
    val campaignId: UUID,
    val instanceNumber: Int,
    val playerCount: Int,
    val maxPlayers: Int,
    val isActive: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant,
)
