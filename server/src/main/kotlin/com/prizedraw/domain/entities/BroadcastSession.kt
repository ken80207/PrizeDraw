package com.prizedraw.domain.entities

import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Represents a live broadcast session started by a player for an unlimited draw campaign.
 *
 * An active session signals to the campaign lobby that the player is streaming. Only one
 * active session per player is permitted at a time; starting a new session ends any
 * previously active one.
 *
 * @param id Unique session identifier.
 * @param campaignId The unlimited campaign being broadcast.
 * @param playerId The player hosting the broadcast.
 * @param isActive `true` while the session is live.
 * @param viewerCount Current connected viewer count — updated periodically from [ConnectionManager].
 * @param startedAt Time the broadcast began.
 * @param endedAt Time the broadcast ended; `null` while still active.
 */
public data class BroadcastSession(
    val id: UUID,
    val campaignId: UUID,
    val playerId: UUID,
    val isActive: Boolean,
    val viewerCount: Int,
    val startedAt: Instant,
    val endedAt: Instant?,
)
