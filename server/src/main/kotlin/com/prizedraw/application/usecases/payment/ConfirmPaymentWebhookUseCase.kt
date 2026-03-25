package com.prizedraw.application.usecases.payment

import com.prizedraw.application.events.PaymentConfirmed
import com.prizedraw.application.ports.input.payment.IConfirmPaymentWebhookUseCase
import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPaymentGateway
import com.prizedraw.application.ports.output.IPaymentOrderRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.PaymentGateway
import com.prizedraw.contracts.enums.PaymentOrderStatus
import com.prizedraw.domain.entities.DrawPointTransaction
import com.prizedraw.domain.entities.PaymentOrder
import com.prizedraw.domain.entities.Player
import kotlinx.datetime.Clock
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Processes an inbound payment gateway webhook and credits draw points on confirmation.
 *
 * Idempotency: if the order is already PAID the operation is a no-op.
 *
 * Single DB transaction:
 * 1. Verify webhook signature via [IPaymentGateway.verifyWebhook].
 * 2. Find the [com.prizedraw.domain.entities.PaymentOrder] by gateway transaction ID.
 * 3. Guard: return early if [PaymentOrderStatus.PAID].
 * 4. Atomically update the order to PAID.
 * 5. Atomically increment the player's [com.prizedraw.domain.entities.Player.drawPointsBalance].
 * 6. Insert a [DrawPointTransaction] ledger entry of type [DrawPointTxType.PURCHASE_CREDIT].
 * 7. Enqueue a [PaymentConfirmed] outbox event.
 */
public class ConfirmPaymentWebhookUseCase(
    private val paymentOrderRepository: IPaymentOrderRepository,
    private val playerRepository: IPlayerRepository,
    private val drawPointTransactionRepository: IDrawPointTransactionRepository,
    private val outboxRepository: IOutboxRepository,
    private val paymentGateway: IPaymentGateway,
) : IConfirmPaymentWebhookUseCase {
    private val log = LoggerFactory.getLogger(ConfirmPaymentWebhookUseCase::class.java)

    @Suppress("ReturnCount")
    override suspend fun execute(
        gateway: PaymentGateway,
        payload: String,
        signature: String,
    ) {
        val webhookResult = paymentGateway.verifyWebhook(payload, signature)

        if (!webhookResult.isValid) {
            throw WebhookVerificationException("Webhook signature verification failed for gateway $gateway")
        }

        if (!webhookResult.isPaid) {
            log.info("Webhook received but payment not confirmed — gateway={}", gateway)
            return
        }

        val gatewayTxnId =
            webhookResult.gatewayTransactionId
                ?: run {
                    log.warn("Webhook missing gatewayTransactionId for gateway {}", gateway)
                    return
                }

        newSuspendedTransaction { processConfirmedPayment(gatewayTxnId) }
    }

    private suspend fun processConfirmedPayment(gatewayTxnId: String) {
        val order =
            paymentOrderRepository.findByGatewayTransactionId(gatewayTxnId)
                ?: run {
                    log.warn("No payment order found for gatewayTransactionId {}", gatewayTxnId)
                    return
                }

        if (order.status == PaymentOrderStatus.PAID) {
            log.info("Payment order {} already PAID — skipping", order.id)
            return
        }

        val now = Clock.System.now()
        markOrderAsPaid(order, now)
        val player = creditPlayerBalance(order)
        recordLedgerEntry(order, player, now)
        enqueueOutboxEvent(order)

        log.info(
            "Payment confirmed: order={} player={} points={}",
            order.id,
            order.playerId,
            order.drawPointsGranted,
        )
    }

    private suspend fun markOrderAsPaid(
        order: PaymentOrder,
        now: kotlinx.datetime.Instant,
    ) {
        paymentOrderRepository.save(
            order.copy(status = PaymentOrderStatus.PAID, paidAt = now, updatedAt = now),
        )
    }

    private suspend fun creditPlayerBalance(order: PaymentOrder): Player {
        val player =
            playerRepository.findById(order.playerId)
                ?: error("Player ${order.playerId} not found for payment order ${order.id}")

        val success =
            playerRepository.updateBalance(
                id = order.playerId,
                drawPointsDelta = order.drawPointsGranted,
                revenuePointsDelta = 0,
                expectedVersion = player.version,
            )

        check(success) {
            "Failed to update player balance due to concurrent modification — retry"
        }
        return player
    }

    private fun recordLedgerEntry(
        order: PaymentOrder,
        player: Player,
        now: kotlinx.datetime.Instant,
    ) {
        drawPointTransactionRepository.record(
            DrawPointTransaction(
                id = UUID.randomUUID(),
                playerId = order.playerId,
                type = DrawPointTxType.PURCHASE_CREDIT,
                amount = order.drawPointsGranted,
                balanceAfter = player.drawPointsBalance + order.drawPointsGranted,
                paymentOrderId = order.id,
                description = "Purchase: ${order.drawPointsGranted} draw points",
                createdAt = now,
            ),
        )
    }

    private suspend fun enqueueOutboxEvent(order: PaymentOrder) {
        outboxRepository.enqueue(
            PaymentConfirmed(
                paymentOrderId = order.id,
                playerId = order.playerId.value,
                drawPointsGranted = order.drawPointsGranted,
                fiatAmount = order.fiatAmount,
            ),
        )
    }
}
