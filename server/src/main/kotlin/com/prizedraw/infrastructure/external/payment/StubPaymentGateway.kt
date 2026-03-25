package com.prizedraw.infrastructure.external.payment

import com.prizedraw.application.ports.output.IPaymentGateway
import com.prizedraw.application.ports.output.PaymentIntentResult
import com.prizedraw.application.ports.output.PaymentWebhookResult
import com.prizedraw.domain.entities.PaymentOrder
import org.slf4j.LoggerFactory

/**
 * Stub implementation of [IPaymentGateway] for local development and testing.
 *
 * Always returns a successful payment intent with a deterministic fake transaction ID
 * and a no-op webhook verifier. Replace with a real gateway adapter (ECPay, Stripe, etc.)
 * before deploying to production.
 */
public class StubPaymentGateway : IPaymentGateway {
    private val log = LoggerFactory.getLogger(StubPaymentGateway::class.java)

    override suspend fun createPaymentIntent(order: PaymentOrder): PaymentIntentResult {
        log.warn("StubPaymentGateway.createPaymentIntent called for order {} — not a real payment", order.id)
        return PaymentIntentResult(
            gatewayTransactionId = "stub-txn-${order.id}",
            checkoutUrl = null,
            expiresAt = null,
            rawMetadata = mapOf("stub" to "true"),
        )
    }

    override suspend fun verifyWebhook(
        payload: String,
        signature: String,
    ): PaymentWebhookResult {
        log.warn("StubPaymentGateway.verifyWebhook called — stub always returns invalid")
        return PaymentWebhookResult(
            isValid = false,
            gatewayTransactionId = null,
            isPaid = false,
            isFailed = false,
        )
    }
}
