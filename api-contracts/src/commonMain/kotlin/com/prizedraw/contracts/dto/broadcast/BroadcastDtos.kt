package com.prizedraw.contracts.dto.broadcast

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

/**
 * Request body for POST `/api/v1/broadcast/start`.
 *
 * @param campaignId The unlimited campaign to broadcast.
 */
@Serializable
public data class StartBroadcastRequest(
    val campaignId: String,
)

/**
 * Request body for POST `/api/v1/broadcast/stop`.
 *
 * @param sessionId The active broadcast session to end.
 */
@Serializable
public data class StopBroadcastRequest(
    val sessionId: String,
)

/**
 * Represents an active or historical broadcast session.
 *
 * @param id Session identifier.
 * @param campaignId Campaign being broadcast.
 * @param playerId Player hosting the broadcast.
 * @param isActive Whether the session is still live.
 * @param viewerCount Current viewer count.
 * @param startedAt Session start time.
 * @param endedAt Session end time; `null` while still active.
 */
@Serializable
public data class BroadcastSessionDto(
    val id: String,
    val campaignId: String,
    val playerId: String,
    val isActive: Boolean,
    val viewerCount: Int,
    val startedAt: Instant,
    val endedAt: Instant?,
)

/**
 * Response body for GET `/api/v1/broadcast/active`.
 *
 * @param campaignId The queried campaign.
 * @param sessions Active broadcast sessions.
 */
@Serializable
public data class ActiveBroadcastsResponse(
    val campaignId: String,
    val sessions: List<BroadcastSessionDto>,
)
