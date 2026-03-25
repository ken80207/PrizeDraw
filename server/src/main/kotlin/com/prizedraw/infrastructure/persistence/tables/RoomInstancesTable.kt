@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table mapping for `room_instances`.
 *
 * Each row represents a single WebSocket room shard for a campaign.
 * The [playerCount] column is mutated exclusively via atomic SQL expressions
 * (`player_count + 1` / `player_count - 1`) — never via a full-row update —
 * to prevent lost-update races under concurrent connections.
 */
public object RoomInstancesTable : Table("room_instances") {
    public val id = uuid("id").autoGenerate()
    public val campaignId = uuid("campaign_id")
    public val instanceNumber = integer("instance_number")
    public val playerCount = integer("player_count").default(0)
    public val maxPlayers = integer("max_players").default(30)
    public val isActive = bool("is_active").default(true)
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

/**
 * Exposed table mapping for `campaign_viewer_stats`.
 *
 * Stores the aggregated viewer count across all shards for a campaign.
 * Upserted by [com.prizedraw.application.services.RoomScalingService] after every
 * join/leave operation so that the global viewer count can be read with a single
 * primary-key lookup instead of a SUM over all shard rows.
 */
public object CampaignViewerStatsTable : Table("campaign_viewer_stats") {
    public val campaignId = uuid("campaign_id")
    public val totalViewers = integer("total_viewers").default(0)
    public val totalInQueue = integer("total_in_queue").default(0)
    public val lastDrawAt = timestampWithTimeZone("last_draw_at").nullable()
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(campaignId)
}
