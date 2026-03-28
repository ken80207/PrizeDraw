@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/** Exposed table for pity_rules. */
public object PityRulesTable : Table("pity_rules") {
    public val id = uuid("id").autoGenerate()
    public val campaignId = uuid("campaign_id")
    public val campaignType = varchar("campaign_type", 32)
    public val threshold = integer("threshold")
    public val accumulationMode = varchar("accumulation_mode", 32)
    public val sessionTimeoutSeconds = integer("session_timeout_seconds").nullable()
    public val enabled = bool("enabled").default(false)
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

/** Exposed table for pity_prize_pool. */
public object PityPrizePoolTable : Table("pity_prize_pool") {
    public val id = uuid("id").autoGenerate()
    public val pityRuleId = uuid("pity_rule_id").references(PityRulesTable.id)
    public val prizeDefinitionId = uuid("prize_definition_id")
    public val weight = integer("weight")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

/** Exposed table for pity_trackers. */
public object PityTrackersTable : Table("pity_trackers") {
    public val id = uuid("id").autoGenerate()
    public val pityRuleId = uuid("pity_rule_id").references(PityRulesTable.id)
    public val playerId = uuid("player_id")
    public val drawCount = integer("draw_count").default(0)
    public val lastDrawAt = timestampWithTimeZone("last_draw_at").nullable()
    public val version = integer("version").default(0)
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
