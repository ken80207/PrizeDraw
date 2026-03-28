package com.prizedraw.contracts.dto.livedraw

import kotlinx.serialization.Serializable

/** A currently active multi-draw session visible on the homepage. */
@Serializable
public data class LiveDrawItemDto(
    val sessionId: String,
    val playerId: String,
    val nickname: String,
    val campaignId: String,
    val campaignTitle: String,
    val quantity: Int,
)

/** Response for GET /api/v1/live-draws. */
@Serializable
public data class LiveDrawsResponse(
    val items: List<LiveDrawItemDto>,
)
