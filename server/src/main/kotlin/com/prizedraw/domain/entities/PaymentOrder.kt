package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.PaymentGateway
import com.prizedraw.contracts.enums.PaymentOrderStatus
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Instant
import kotlinx.serialization.json.JsonObject
import java.util.UUID

/**
 * A player's fiat-currency purchase of draw points via a third-party payment gateway (金流訂單).
 *
 * Points are only credited once the gateway confirms payment via callback. The [id] is
 * also used as the merchant order ID sent to the payment gateway, so it must be globally
 * unique and stable.
 *
 * Gateway-specific response details are stored in [gatewayMetadata] as a JSON object for
 * debugging and reconciliation without imposing a rigid schema.
 *
 * @property id Surrogate primary key; also the merchant order ID sent to the gateway.
 * @property playerId FK to the purchasing [Player].
 * @property fiatAmount Charge amount in the smallest currency unit (e.g. TWD has no sub-units).
 * @property currencyCode ISO 4217 currency code, e.g. `TWD`.
 * @property drawPointsGranted Draw points credited on successful payment.
 * @property gateway The payment gateway used.
 * @property gatewayTransactionId Third-party transaction reference. Unique when non-null.
 * @property paymentMethod Gateway-specific method string, e.g. `credit_card`, `apple_pay`.
 * @property gatewayMetadata Raw gateway response data as a JSON object.
 * @property status Current payment state.
 * @property paidAt Gateway-confirmed payment timestamp.
 * @property failedAt Timestamp when the payment failed.
 * @property refundedAt Timestamp when the payment was refunded.
 * @property expiresAt Payment window expiry (e.g. CVS code expires in 3 days).
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class PaymentOrder(
    val id: UUID,
    val playerId: PlayerId,
    val fiatAmount: Int,
    val currencyCode: String,
    val drawPointsGranted: Int,
    val gateway: PaymentGateway,
    val gatewayTransactionId: String?,
    val paymentMethod: String?,
    val gatewayMetadata: JsonObject,
    val status: PaymentOrderStatus,
    val paidAt: Instant?,
    val failedAt: Instant?,
    val refundedAt: Instant?,
    val expiresAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)
