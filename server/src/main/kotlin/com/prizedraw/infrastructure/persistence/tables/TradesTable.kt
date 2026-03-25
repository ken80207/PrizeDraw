@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definitions for the marketplace trade and prize exchange subsystems.
 *
 * Covers `trade_orders`, `exchange_requests`, and `exchange_request_items`.
 */
public object TradeOrdersTable : Table("trade_orders") {
    public val id = uuid("id").autoGenerate()
    public val sellerId = uuid("seller_id")
    public val buyerId = uuid("buyer_id").nullable()
    public val prizeInstanceId = uuid("prize_instance_id")
    public val listPrice = integer("list_price")
    public val feeRateBps = integer("fee_rate_bps")
    public val feeAmount = integer("fee_amount").nullable()
    public val sellerProceeds = integer("seller_proceeds").nullable()
    public val status = varchar("status", 32).default("LISTED")
    public val listedAt = timestampWithTimeZone("listed_at")
    public val completedAt = timestampWithTimeZone("completed_at").nullable()
    public val cancelledAt = timestampWithTimeZone("cancelled_at").nullable()
    public val deletedAt = timestampWithTimeZone("deleted_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object ExchangeRequestsTable : Table("exchange_requests") {
    public val id = uuid("id").autoGenerate()
    public val initiatorId = uuid("initiator_id")
    public val recipientId = uuid("recipient_id")
    public val parentRequestId = uuid("parent_request_id").nullable()
    public val status = varchar("status", 32).default("PENDING")
    public val message = text("message").nullable()
    public val respondedAt = timestampWithTimeZone("responded_at").nullable()
    public val completedAt = timestampWithTimeZone("completed_at").nullable()
    public val cancelledAt = timestampWithTimeZone("cancelled_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object ExchangeRequestItemsTable : Table("exchange_request_items") {
    public val id = uuid("id").autoGenerate()
    public val exchangeRequestId = uuid("exchange_request_id")
    public val prizeInstanceId = uuid("prize_instance_id")
    public val side = varchar("side", 32)
    public val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
