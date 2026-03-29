@file:Suppress("MagicNumber")

package com.prizedraw.schema.tables

import com.prizedraw.contracts.enums.PrizeAcquisitionMethod
import com.prizedraw.contracts.enums.PrizeState
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.json.jsonb
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definitions for prize template definitions and concrete prize instances.
 *
 * [PrizeDefinitionsTable.photos] is stored as a `jsonb` column containing a JSON array of
 * CDN URL strings. [PrizeInstancesTable] tracks the full lifecycle state machine via the
 * `prize_instance_state` PG enum.
 *
 * Note: `prize_definitions.grade` is a plain `VARCHAR(32)` in the DB schema (not a PG enum),
 * so it remains mapped as [varchar].
 */
public object PrizeDefinitionsTable : Table("prize_definitions") {
    public val id = uuid("id").autoGenerate()
    public val kujiCampaignId = uuid("kuji_campaign_id").nullable()
    public val unlimitedCampaignId = uuid("unlimited_campaign_id").nullable()
    public val grade = varchar("grade", 32)
    public val name = varchar("name", 255)
    public val photos = jsonb("photos", { it }, { it })
    public val prizeValue = integer("prize_value").default(0)
    public val buybackPrice = integer("buyback_price").default(0)
    public val buybackEnabled = bool("buyback_enabled").default(true)
    public val probabilityBps = integer("probability_bps").nullable()
    public val ticketCount = integer("ticket_count").nullable()
    public val displayOrder = integer("display_order").default(0)
    public val isRare = bool("is_rare").default(false)
    public val campaignGradeId = uuid("campaign_grade_id").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object PrizeInstancesTable : Table("prize_instances") {
    public val id = uuid("id").autoGenerate()
    public val prizeDefinitionId = uuid("prize_definition_id")
    public val ownerId = uuid("owner_id")

    /** Maps to the `prize_acquisition_method` PG enum. */
    public val acquisitionMethod =
        pgEnum<PrizeAcquisitionMethod>(
            "acquisition_method",
            "prize_acquisition_method",
        )
    public val sourceDrawTicketId = uuid("source_draw_ticket_id").nullable()
    public val sourceTradeOrderId = uuid("source_trade_order_id").nullable()
    public val sourceExchangeRequestId = uuid("source_exchange_request_id").nullable()

    /** Maps to the `prize_instance_state` PG enum. */
    public val state =
        pgEnum<PrizeState>("state", "prize_instance_state")
            .default(PrizeState.HOLDING)
    public val acquiredAt = timestampWithTimeZone("acquired_at")
    public val deletedAt = timestampWithTimeZone("deleted_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
