package com.prizedraw.contracts.dto.feed

import com.prizedraw.contracts.enums.CampaignType
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

/**
 * A single draw event surfaced in the live feed.
 *
 * @param drawId Unique identifier of the draw result.
 * @param playerId Identifier of the player who drew.
 * @param playerNickname Display name of the player at draw time.
 * @param playerAvatarUrl URL of the player's avatar, or null if not set.
 * @param campaignId Identifier of the campaign the draw belongs to.
 * @param campaignTitle Human-readable campaign title.
 * @param campaignType Whether the campaign is KUJI or UNLIMITED.
 * @param prizeGrade Grade label of the prize won (e.g. "A", "Last").
 * @param prizeName Display name of the prize won.
 * @param prizePhotoUrl URL of the prize photo, or null if not available.
 * @param drawnAt Server-side timestamp of when the draw occurred.
 */
@Serializable
public data class DrawFeedEventDto(
    val drawId: String,
    val playerId: String,
    val playerNickname: String,
    val playerAvatarUrl: String?,
    val campaignId: String,
    val campaignTitle: String,
    val campaignType: CampaignType,
    val prizeGrade: String,
    val prizeName: String,
    val prizePhotoUrl: String?,
    val drawnAt: Instant,
)

/**
 * Response body for GET [com.prizedraw.contracts.endpoints.FeedEndpoints.RECENT].
 *
 * @param items Draw feed events ordered newest-first.
 */
@Serializable
public data class FeedRecentResponse(
    val items: List<DrawFeedEventDto>,
)
