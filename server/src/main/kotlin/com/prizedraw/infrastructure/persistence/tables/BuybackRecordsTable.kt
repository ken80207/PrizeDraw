@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definition for the `buyback_records` table.
 *
 * Records are INSERT-only; the application layer must never UPDATE or DELETE rows.
 * The [buybackPrice] is snapshotted at submission time for analytics stability.
 */
public object BuybackRecordsTable : Table("buyback_records") {
    public val id = uuid("id").autoGenerate()
    public val playerId = uuid("player_id")
    public val prizeInstanceId = uuid("prize_instance_id")
    public val prizeDefinitionId = uuid("prize_definition_id")
    public val buybackPrice = integer("buyback_price")
    public val processedAt = timestampWithTimeZone("processed_at")
    public val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
