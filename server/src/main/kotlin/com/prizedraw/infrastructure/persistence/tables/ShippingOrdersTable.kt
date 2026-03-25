@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definition for the `shipping_orders` table.
 *
 * Records physical prize shipment requests. One-to-one with the [PrizeInstance] being shipped.
 */
public object ShippingOrdersTable : Table("shipping_orders") {
    public val id = uuid("id").autoGenerate()
    public val playerId = uuid("player_id")
    public val prizeInstanceId = uuid("prize_instance_id")
    public val recipientName = varchar("recipient_name", 128)
    public val recipientPhone = varchar("recipient_phone", 20)
    public val addressLine1 = varchar("address_line1", 255)
    public val addressLine2 = varchar("address_line2", 255).nullable()
    public val city = varchar("city", 128)
    public val postalCode = varchar("postal_code", 20)
    public val countryCode = char("country_code", 2).default("TW")
    public val trackingNumber = varchar("tracking_number", 128).nullable()
    public val carrier = varchar("carrier", 64).nullable()
    public val status = varchar("status", 32).default("PENDING_SHIPMENT")
    public val shippedAt = timestampWithTimeZone("shipped_at").nullable()
    public val deliveredAt = timestampWithTimeZone("delivered_at").nullable()
    public val cancelledAt = timestampWithTimeZone("cancelled_at").nullable()
    public val fulfilledByStaffId = uuid("fulfilled_by_staff_id").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
