@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.json.jsonb
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definitions for the customer support subsystem.
 *
 * Covers `support_tickets` and `support_ticket_messages`.
 * [SupportTicketMessagesTable.attachments] is stored as `jsonb` for attachment metadata.
 */
public object SupportTicketsTable : Table("support_tickets") {
    public val id = uuid("id").autoGenerate()
    public val playerId = uuid("player_id")
    public val assignedToStaffId = uuid("assigned_to_staff_id").nullable()
    public val category = varchar("category", 64)
    public val subject = varchar("subject", 255)
    public val status = varchar("status", 32).default("OPEN")
    public val priority = varchar("priority", 32).default("NORMAL")
    public val satisfactionScore = short("satisfaction_score").nullable()
    public val lineThreadId = varchar("line_thread_id", 255).nullable()
    public val contextTradeOrderId = uuid("context_trade_order_id").nullable()
    public val contextPaymentOrderId = uuid("context_payment_order_id").nullable()
    public val contextShippingOrderId = uuid("context_shipping_order_id").nullable()
    public val contextWithdrawalId = uuid("context_withdrawal_id").nullable()
    public val resolvedAt = timestampWithTimeZone("resolved_at").nullable()
    public val closedAt = timestampWithTimeZone("closed_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object SupportTicketMessagesTable : Table("support_ticket_messages") {
    public val id = uuid("id").autoGenerate()
    public val supportTicketId = uuid("support_ticket_id")
    public val authorPlayerId = uuid("author_player_id").nullable()
    public val authorStaffId = uuid("author_staff_id").nullable()
    public val body = text("body")
    public val attachments = jsonb("attachments", { it }, { it })
    public val channel = varchar("channel", 32).default("PLATFORM")
    public val lineMessageId = varchar("line_message_id", 255).nullable()
    public val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
