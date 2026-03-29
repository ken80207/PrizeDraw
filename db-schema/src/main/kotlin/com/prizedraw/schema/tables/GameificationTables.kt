@file:Suppress("MagicNumber")

package com.prizedraw.schema.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definition for the `chat_messages` table (V015 migration).
 *
 * Primary delivery is via Redis pub/sub; this table persists messages for history
 * retrieval and the 7-day cleanup job.
 */
public object ChatMessagesTable : Table("chat_messages") {
    public val id = uuid("id").autoGenerate()
    public val roomId = varchar("room_id", 128)
    public val playerId = uuid("player_id")
    public val message = text("message")
    public val isReaction = bool("is_reaction").default(false)
    public val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

/**
 * Exposed table definition for the `broadcast_sessions` table (V015 migration).
 *
 * Tracks active unlimited-draw live streams. Only one active row per player is
 * permitted — enforced at the service layer.
 */
public object BroadcastSessionsTable : Table("broadcast_sessions") {
    public val id = uuid("id").autoGenerate()
    public val campaignId = uuid("campaign_id")
    public val playerId = uuid("player_id")
    public val isActive = bool("is_active").default(true)
    public val viewerCount = integer("viewer_count").default(0)
    public val startedAt = timestampWithTimeZone("started_at")
    public val endedAt = timestampWithTimeZone("ended_at").nullable()

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

/**
 * Exposed table definition for the `draw_sync_sessions` table (V015 migration).
 *
 * Stores pre-computed draw results alongside animation progress. Result fields are
 * **never** included in spectator broadcasts until [isRevealed] is set to `true`.
 */
public object DrawSyncSessionsTable : Table("draw_sync_sessions") {
    public val id = uuid("id").autoGenerate()
    public val ticketId = uuid("ticket_id").nullable().uniqueIndex()
    public val campaignId = uuid("campaign_id")
    public val playerId = uuid("player_id")
    public val animationMode = varchar("animation_mode", 32)
    public val resultGrade = varchar("result_grade", 16).nullable()
    public val resultPrizeName = varchar("result_prize_name", 255).nullable()
    public val resultPhotoUrl = text("result_photo_url").nullable()
    public val resultPrizeInstanceId = uuid("result_prize_instance_id").nullable()
    public val progress = float("progress").default(0f)
    public val isRevealed = bool("is_revealed").default(false)
    public val isCancelled = bool("is_cancelled").default(false)
    public val startedAt = timestampWithTimeZone("started_at")
    public val revealedAt = timestampWithTimeZone("revealed_at").nullable()
    public val cancelledAt = timestampWithTimeZone("cancelled_at").nullable()

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
