@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definition for the `xp_transactions` table (V018 migration).
 *
 * Every XP credit is recorded here for auditing and the player's XP history feed.
 * The table is insert-only; XP is never revoked.
 */
public object XpTransactionsTable : Table("xp_transactions") {
    public val id = uuid("id").autoGenerate()
    public val playerId = uuid("player_id").references(PlayersTable.id)
    public val amount = integer("amount")
    public val sourceType = varchar("source_type", 32)
    public val sourceId = uuid("source_id").nullable()
    public val description = text("description").nullable()
    public val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

/**
 * Exposed table definition for the `tier_configs` table (V018 migration).
 *
 * Tier config rows are admin-managed reference data seeded by the V018 migration.
 * The [tier] column is the natural primary key (e.g. `BRONZE`, `GOLD`).
 */
public object TierConfigsTable : Table("tier_configs") {
    public val tier = varchar("tier", 32)
    public val displayName = varchar("display_name", 64)
    public val minXp = integer("min_xp")
    public val icon = varchar("icon", 16)
    public val color = varchar("color", 16)
    public val benefits = text("benefits") // stored as JSON string, parsed in repository
    public val sortOrder = integer("sort_order")

    override val primaryKey: PrimaryKey = PrimaryKey(tier)
}
