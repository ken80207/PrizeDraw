package com.prizedraw.application.ports.input.payment

import com.prizedraw.contracts.enums.PaymentGateway

/**
 * Input port for processing an inbound payment gateway webhook.
 *
 * Idempotent: safe to call multiple times for the same payment event.
 * On a confirmed payment the operation runs inside a single DB transaction:
 * sets the order to PAID, credits draw points, inserts a ledger entry, and
 * enqueues a [com.prizedraw.application.events.PaymentConfirmed] outbox event.
 */
public interface IConfirmPaymentWebhookUseCase {
    /**
     * Processes a raw webhook payload from the given payment gateway.
     *
     * @param gateway The payment gateway that sent this webhook.
     * @param payload The raw request body string.
     * @param signature The gateway-specific signature header value.
     */
    public suspend fun execute(
        gateway: PaymentGateway,
        payload: String,
        signature: String,
    )
}
