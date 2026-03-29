@file:Suppress("MagicNumber")

package com.prizedraw.schema.tables

import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.RevenuePointTxType
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definitions for the immutable double-entry ledger tables.
 *
 * Both tables are INSERT-only; the application layer must never UPDATE or DELETE rows.
 * The `type` column in each table maps to a PG enum via [pgEnum] rather than `varchar`,
 * avoiding `operator does not exist` errors on enum comparisons.
 */
public object DrawPointTransactionsTable : Table("draw_point_transactions") {
    public val id = uuid("id").autoGenerate()
    public val playerId = uuid("player_id")
    public val type = pgEnum<DrawPointTxType>("type", "draw_point_tx_type")
    public val amount = integer("amount")
    public val balanceAfter = integer("balance_after")
    public val paymentOrderId = uuid("payment_order_id").nullable()
    public val tradeOrderId = uuid("trade_order_id").nullable()
    public val drawTicketId = uuid("draw_ticket_id").nullable()
    public val unlimitedCampaignId = uuid("unlimited_campaign_id").nullable()
    public val playerCouponId = uuid("player_coupon_id").nullable()
    public val originalAmount = integer("original_amount").nullable()
    public val discountAmount = integer("discount_amount").nullable()
    public val description = text("description").nullable()
    public val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object RevenuePointTransactionsTable : Table("revenue_point_transactions") {
    public val id = uuid("id").autoGenerate()
    public val playerId = uuid("player_id")
    public val type = pgEnum<RevenuePointTxType>("type", "revenue_point_tx_type")
    public val amount = integer("amount")
    public val balanceAfter = integer("balance_after")
    public val tradeOrderId = uuid("trade_order_id").nullable()
    public val buybackRecordId = uuid("buyback_record_id").nullable()
    public val withdrawalRequestId = uuid("withdrawal_request_id").nullable()
    public val description = text("description").nullable()
    public val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
