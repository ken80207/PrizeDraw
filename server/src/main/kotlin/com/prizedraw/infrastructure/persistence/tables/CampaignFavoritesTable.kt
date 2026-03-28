@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definition for the `campaign_favorites` table.
 *
 * Stores player wishlist entries keyed by (player_id, campaign_type, campaign_id).
 * The composite primary key enforces at-most-one favorite per player per campaign.
 */
public object CampaignFavoritesTable : Table("campaign_favorites") {
    /** FK to the player who favorited the campaign. */
    public val playerId = uuid("player_id").references(PlayersTable.id)

    /** Discriminator for campaign variant: `KUJI` or `UNLIMITED`. */
    public val campaignType = varchar("campaign_type", 16)

    /** UUID of the favorited campaign (references kuji_campaigns.id or unlimited_campaigns.id). */
    public val campaignId = uuid("campaign_id")

    /** Timestamp when the player added this campaign to their favorites. */
    public val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey: PrimaryKey = PrimaryKey(playerId, campaignType, campaignId)
}
