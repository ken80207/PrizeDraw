package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.ShippingOrderStatus
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A player's request to have a physical prize mailed to them (寄送訂單).
 *
 * One-to-one with the [PrizeInstance] it covers. Operators fulfill and track
 * shipment from the back-office. Auto-confirmation to [ShippingOrderStatus.DELIVERED]
 * is triggered by a scheduled job N days after [shippedAt] if the player has not confirmed.
 *
 * @property id Surrogate primary key.
 * @property playerId FK to the requesting [Player].
 * @property prizeInstanceId FK to the [PrizeInstance] being shipped. Unique.
 * @property recipientName Recipient full name.
 * @property recipientPhone Recipient contact phone (E.164 format).
 * @property addressLine1 Street address.
 * @property addressLine2 Apartment, floor, or additional address info. Null if not set.
 * @property city City name.
 * @property postalCode Postal or ZIP code.
 * @property countryCode ISO 3166-1 alpha-2 country code, e.g. `TW`.
 * @property trackingNumber Courier tracking number. Set by operator on shipment.
 * @property carrier Carrier name, e.g. `黑貓宅急便`. Set alongside [trackingNumber].
 * @property status Current shipment state.
 * @property shippedAt Set by operator when transitioning to SHIPPED.
 * @property deliveredAt Set on player confirmation or auto-confirm.
 * @property cancelledAt Set when the order is cancelled.
 * @property fulfilledByStaffId FK to the Staff member who marked the shipment. Null until shipped.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class ShippingOrder(
    val id: UUID,
    val playerId: PlayerId,
    val prizeInstanceId: PrizeInstanceId,
    val recipientName: String,
    val recipientPhone: String,
    val addressLine1: String,
    val addressLine2: String?,
    val city: String,
    val postalCode: String,
    val countryCode: String,
    val trackingNumber: String?,
    val carrier: String?,
    val status: ShippingOrderStatus,
    val shippedAt: Instant?,
    val deliveredAt: Instant?,
    val cancelledAt: Instant?,
    val fulfilledByStaffId: UUID?,
    val createdAt: Instant,
    val updatedAt: Instant,
)
