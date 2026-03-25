package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.PaymentOrder

/**
 * Result of a payment intent creation request sent to an external payment gateway.
 *
 * @property gatewayTransactionId The gateway's own transaction or order reference.
 * @property checkoutUrl URL to redirect the player to complete payment, if applicable.
 * @property expiresAt When this payment intent expires (e.g. CVS code validity).
 * @property rawMetadata Raw gateway response preserved for debugging and reconciliation.
 */
public data class PaymentIntentResult(
    val gatewayTransactionId: String?,
    val checkoutUrl: String?,
    val expiresAt: kotlinx.datetime.Instant?,
    val rawMetadata: Map<String, String>,
)

/**
 * Result of parsing and verifying an inbound payment gateway webhook.
 *
 * @property isValid True if the webhook signature was verified and the payload is well-formed.
 * @property gatewayTransactionId The gateway's transaction reference extracted from the payload.
 * @property isPaid True if the gateway reported a successful payment.
 * @property isFailed True if the gateway reported a payment failure.
 */
public data class PaymentWebhookResult(
    val isValid: Boolean,
    val gatewayTransactionId: String?,
    val isPaid: Boolean,
    val isFailed: Boolean,
)

/**
 * Output port for interacting with external payment gateways (金流閘道).
 *
 * Implementations in the infrastructure layer are gateway-specific (ECPay, Stripe, etc.)
 * and are selected at runtime via the [com.prizedraw.domain.entities.PaymentOrder.gateway] field.
 */
public interface IPaymentGateway {
    /**
     * Creates a payment intent with the external gateway for the given [PaymentOrder].
     *
     * The caller is responsible for persisting the returned [PaymentIntentResult.gatewayTransactionId]
     * on the [PaymentOrder] and redirecting the player to [PaymentIntentResult.checkoutUrl].
     *
     * @param order The payment order describing the charge amount, currency, and product.
     * @return The gateway's response containing the transaction reference and checkout URL.
     */
    public suspend fun createPaymentIntent(order: PaymentOrder): PaymentIntentResult

    /**
     * Verifies and parses an inbound webhook from the payment gateway.
     *
     * Implementations must validate the [signature] against the [payload] using the
     * gateway-specific HMAC or RSA verification scheme before extracting the result.
     *
     * @param payload The raw webhook request body as a string.
     * @param signature The signature header value sent by the gateway.
     * @return Parsed and verified webhook result.
     */
    public suspend fun verifyWebhook(
        payload: String,
        signature: String,
    ): PaymentWebhookResult
}
