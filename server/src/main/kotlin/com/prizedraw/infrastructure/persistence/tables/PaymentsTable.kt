@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.persistence.tables

import com.prizedraw.contracts.enums.PaymentGateway
import com.prizedraw.contracts.enums.PaymentOrderStatus
import com.prizedraw.contracts.enums.WithdrawalStatus
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.json.jsonb
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definitions for the payment and withdrawal subsystems.
 *
 * Covers `payment_orders` and `withdrawal_requests`.
 * [PaymentOrdersTable.gatewayMetadata] is stored as `jsonb` for raw gateway response data.
 * Enum columns ([PaymentOrdersTable.gateway], [PaymentOrdersTable.status],
 * [WithdrawalRequestsTable.status]) map to their respective PG enum types.
 */
public object PaymentOrdersTable : Table("payment_orders") {
    public val id = uuid("id").autoGenerate()
    public val playerId = uuid("player_id")
    public val fiatAmount = integer("fiat_amount")
    public val currencyCode = char("currency_code", 3).default("TWD")
    public val drawPointsGranted = integer("draw_points_granted")
    public val gateway = pgEnum<PaymentGateway>("gateway", "payment_gateway")
    public val gatewayTransactionId = varchar("gateway_transaction_id", 255).nullable()
    public val paymentMethod = varchar("payment_method", 64).nullable()
    public val gatewayMetadata = jsonb("gateway_metadata", { it }, { it })
    public val status =
        pgEnum<PaymentOrderStatus>("status", "payment_order_status")
            .default(PaymentOrderStatus.PENDING)
    public val paidAt = timestampWithTimeZone("paid_at").nullable()
    public val failedAt = timestampWithTimeZone("failed_at").nullable()
    public val refundedAt = timestampWithTimeZone("refunded_at").nullable()
    public val expiresAt = timestampWithTimeZone("expires_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object WithdrawalRequestsTable : Table("withdrawal_requests") {
    public val id = uuid("id").autoGenerate()
    public val playerId = uuid("player_id")
    public val pointsAmount = integer("points_amount")
    public val fiatAmount = integer("fiat_amount")
    public val currencyCode = char("currency_code", 3).default("TWD")
    public val bankName = varchar("bank_name", 128)
    public val bankCode = varchar("bank_code", 16)
    public val accountHolderName = varchar("account_holder_name", 128)
    public val accountNumber = varchar("account_number", 64)
    public val status =
        pgEnum<WithdrawalStatus>("status", "withdrawal_status")
            .default(WithdrawalStatus.PENDING_REVIEW)
    public val reviewedByStaffId = uuid("reviewed_by_staff_id").nullable()
    public val reviewedAt = timestampWithTimeZone("reviewed_at").nullable()
    public val transferredAt = timestampWithTimeZone("transferred_at").nullable()
    public val rejectionReason = text("rejection_reason").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
