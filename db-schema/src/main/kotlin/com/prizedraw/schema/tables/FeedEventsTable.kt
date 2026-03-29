@file:Suppress("MagicNumber")

package com.prizedraw.schema.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table object for the `feed_events` denormalised draw-result store.
 *
 * All display data required by the live-draw feed is captured at write time so the
 * REST endpoint can serve recent events with a single indexed query and no joins.
 */
public object FeedEventsTable : Table("feed_events") {
    public val id = uuid("id")
    public val drawId = varchar("draw_id", 255)
    public val playerId = uuid("player_id")
    public val playerNickname = varchar("player_nickname", 255)
    public val playerAvatarUrl = text("player_avatar_url").nullable()
    public val campaignId = uuid("campaign_id")
    public val campaignTitle = varchar("campaign_title", 255)
    public val campaignType = varchar("campaign_type", 20)
    public val prizeGrade = varchar("prize_grade", 50)
    public val prizeName = varchar("prize_name", 255)
    public val prizePhotoUrl = text("prize_photo_url").nullable()
    public val drawnAt = timestampWithTimeZone("drawn_at")
    public val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
