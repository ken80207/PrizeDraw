package com.prizedraw.contracts.dto.room

import kotlinx.serialization.Serializable

/**
 * A single active WebSocket room shard for a campaign.
 *
 * Returned as part of [CampaignStatsDto] and sent to the client as the
 * `S2C_ROOM_ASSIGNED` WebSocket event payload when a player first connects.
 *
 * @param id UUID of the shard (used as the WebSocket room key `room:{id}`).
 * @param instanceNumber Human-readable shard index (1, 2, 3 …).
 * @param playerCount Current number of connected players in this shard.
 * @param maxPlayers Shard capacity ceiling.
 */
@Serializable
public data class RoomInstanceDto(
    val id: String,
    val instanceNumber: Int,
    val playerCount: Int,
    val maxPlayers: Int,
)

/**
 * Aggregated viewer stats for a campaign, spanning all active shards.
 *
 * Returned by `GET /api/v1/campaigns/{id}/stats` and also broadcast as the
 * `S2C_ROOM_STATS` WebSocket event at connect time and after every join/leave.
 *
 * ### Frontend rendering contract
 * - Display [totalViewers] as the global online indicator: "1,234 人在線".
 * - [rooms] is ordered by [RoomInstanceDto.instanceNumber]; use it to populate a
 *   shard-picker UI when a player wants to switch rooms.
 * - Chat throttling: render at most 5 messages per second per shard in the UI.
 * - Aggregate identical emoji reactions: show "x23" rather than 23 separate bubbles.
 *
 * @param totalViewers Sum of player counts across all active shards.
 * @param activeRooms Number of currently active shards.
 * @param totalInQueue Players currently waiting in the draw queue.
 * @param rooms Per-shard snapshot ordered by instance number.
 */
@Serializable
public data class CampaignStatsDto(
    val totalViewers: Int,
    val activeRooms: Int,
    val totalInQueue: Int,
    val rooms: List<RoomInstanceDto>,
)

/**
 * `S2C_ROOM_ASSIGNED` — sent to a client immediately after they connect to a kuji room.
 *
 * The client should store [roomInstanceId] and use it as the WebSocket room key
 * `room:{roomInstanceId}` for chat messages. Draw events are broadcast globally via
 * the campaign-level pub/sub channel `campaign:{campaignId}:draws` and therefore reach
 * clients regardless of which shard they are on.
 *
 * @param roomInstanceId UUID of the assigned shard.
 * @param instanceNumber Human-readable shard index shown in the UI.
 * @param playerCount Current player count in the assigned shard at the moment of assignment.
 * @param maxPlayers Shard capacity ceiling.
 */
@Serializable
public data class RoomAssignedEvent(
    val roomInstanceId: String,
    val instanceNumber: Int,
    val playerCount: Int,
    val maxPlayers: Int,
)
