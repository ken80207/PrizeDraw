package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.CampaignType
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Denormalised record of a single draw result written to the [feed_events] table.
 *
 * All display data needed by the live-draw feed REST endpoint is captured at write time,
 * eliminating the N+1 query pattern that previously resolved player, prize, ticket-box,
 * and campaign in separate round-trips. Both KUJI and UNLIMITED draw types write here.
 *
 * @param id Surrogate primary key.
 * @param drawId Opaque draw identifier (UUID string for kuji tickets, or an unlimited draw ID).
 * @param playerId Identifier of the player who drew.
 * @param playerNickname Display name of the player at draw time.
 * @param playerAvatarUrl URL of the player's avatar, or null if not set.
 * @param campaignId Identifier of the campaign the draw belongs to.
 * @param campaignTitle Human-readable campaign title at draw time.
 * @param campaignType Whether the campaign is KUJI or UNLIMITED.
 * @param prizeGrade Grade label of the prize won (e.g. "A", "Last").
 * @param prizeName Display name of the prize won.
 * @param prizePhotoUrl URL of the prize photo, or null if not available.
 * @param drawnAt Server-side timestamp of when the draw occurred.
 * @param createdAt Row insertion timestamp (set by the DB default or application clock).
 */
public data class FeedEvent(
    val id: UUID,
    val drawId: String,
    val playerId: UUID,
    val playerNickname: String,
    val playerAvatarUrl: String?,
    val campaignId: UUID,
    val campaignTitle: String,
    val campaignType: CampaignType,
    val prizeGrade: String,
    val prizeName: String,
    val prizePhotoUrl: String?,
    val drawnAt: Instant,
    val createdAt: Instant,
)
