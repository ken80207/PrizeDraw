package com.prizedraw.contracts.dto.follow

import kotlinx.serialization.Serializable

/** A player summary used in follow lists and search results. */
@Serializable
public data class FollowPlayerDto(
    val playerId: String,
    val nickname: String,
    val avatarUrl: String?,
    val playerCode: String,
    val isFollowing: Boolean = false,
)

/** Paginated follow list response. */
@Serializable
public data class FollowListResponse(
    val items: List<FollowPlayerDto>,
    val total: Int,
    val limit: Int,
    val offset: Int,
)

/** Follow status check response. */
@Serializable
public data class FollowStatusResponse(
    val isFollowing: Boolean,
)

/** Batch follow status request body. */
@Serializable
public data class BatchFollowStatusRequest(
    val playerIds: List<String>,
)

/** Batch follow status response. Maps player IDs to follow status. */
@Serializable
public data class BatchFollowStatusResponse(
    val statuses: Map<String, Boolean>,
)

/** Player search result. */
@Serializable
public data class PlayerSearchResponse(
    val player: FollowPlayerDto?,
)
