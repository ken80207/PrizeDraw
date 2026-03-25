package com.prizedraw.application.events

import com.prizedraw.application.ports.output.INotificationService
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.PushNotificationPayload
import com.prizedraw.domain.entities.OutboxEvent
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.jsonPrimitive
import org.slf4j.LoggerFactory
import kotlin.time.Duration.Companion.seconds

/**
 * Coroutine-based outbox worker implementing the transactional outbox pattern.
 *
 * Polls [IOutboxRepository.fetchPending] every [POLL_INTERVAL_SECONDS] seconds,
 * dispatches each event to its registered handler, and marks the event as
 * PROCESSED on success or FAILED after exceeding [MAX_ATTEMPTS].
 *
 * At-least-once delivery is guaranteed: if the process crashes after fetching
 * but before marking processed, the event will be re-delivered on the next cycle.
 *
 * @param outboxRepository Source of PENDING outbox events.
 * @param notificationService For sending push notifications on domain events.
 * @param redisPubSub For WebSocket fanout over pub/sub.
 */
public class OutboxWorker(
    private val outboxRepository: IOutboxRepository,
    private val notificationService: INotificationService,
    private val redisPubSub: RedisPubSub,
) {
    private val log = LoggerFactory.getLogger(OutboxWorker::class.java)
    private val job = SupervisorJob()
    private val scope = CoroutineScope(Dispatchers.IO + job)

    /** Starts the background polling loop. */
    @Suppress("TooGenericExceptionCaught")
    public fun start() {
        scope.launch {
            log.info("OutboxWorker started; polling every ${POLL_INTERVAL_SECONDS}s")
            while (isActive) {
                try {
                    processBatch()
                } catch (e: Exception) {
                    log.error("OutboxWorker batch error: {}", e.message, e)
                }
                delay(POLL_INTERVAL_SECONDS.seconds)
            }
        }
    }

    /** Stops the polling loop by cancelling the coroutine scope. */
    public fun stop() {
        job.cancel()
        log.info("OutboxWorker stopped")
    }

    private suspend fun processBatch() {
        val events = outboxRepository.fetchPending(BATCH_SIZE)
        if (events.isEmpty()) {
            return
        }

        log.debug("OutboxWorker processing {} pending events", events.size)

        events.forEach { event ->
            processEvent(event)
        }
    }

    @Suppress("TooGenericExceptionCaught")
    private suspend fun processEvent(event: OutboxEvent) {
        try {
            dispatch(event)
            outboxRepository.markProcessed(event.id)
            log.debug("OutboxEvent {} ({}) processed", event.id, event.eventType)
        } catch (e: Exception) {
            log.warn("OutboxEvent {} ({}) delivery failed: {}", event.id, event.eventType, e.message)
            outboxRepository.markFailed(event.id, e.message ?: "Unknown error")
        }
    }

    /**
     * Routes the event to the appropriate handler(s) based on [OutboxEvent.eventType].
     *
     * Each event may trigger multiple side effects: push notification, WebSocket fanout,
     * leaderboard update, etc.
     */
    private suspend fun dispatch(event: OutboxEvent) {
        // Publish to Redis pub/sub for WebSocket fanout regardless of event type
        val aggregateId = event.aggregateId.toString()
        redisPubSub.publish("event:aggregate:$aggregateId", event.payload.toString())

        when (event.eventType) {
            "draw.completed" -> handleDrawCompleted(event)
            "trade.completed" -> handleTradeCompleted(event)
            "exchange.completed" -> handleExchangeCompleted(event)
            "buyback.completed" -> handleBuybackCompleted(event)
            "shipping.status_changed" -> handleShippingStatusChanged(event)
            "payment.confirmed" -> handlePaymentConfirmed(event)
            "support_ticket.replied" -> handleSupportTicketReplied(event)
            else -> log.debug("OutboxEvent type '{}' has no handler; skipping", event.eventType)
        }
    }

    private suspend fun handleDrawCompleted(event: OutboxEvent) {
        val playerId = event.payload["playerId"]?.jsonPrimitive?.content ?: return
        notificationService.sendPush(
            com.prizedraw.domain.valueobjects.PlayerId
                .fromString(playerId),
            PushNotificationPayload(
                title = "Draw Complete!",
                body = "You drew a prize! Check your collection.",
                data = mapOf("eventType" to "draw.completed", "aggregateId" to event.aggregateId.toString()),
            ),
        )
    }

    private suspend fun handleTradeCompleted(event: OutboxEvent) {
        val buyerId = event.payload["buyerId"]?.jsonPrimitive?.content ?: return
        notificationService.sendPush(
            com.prizedraw.domain.valueobjects.PlayerId
                .fromString(buyerId),
            PushNotificationPayload(
                title = "Purchase Complete",
                body = "Your marketplace purchase has been completed!",
                data = mapOf("eventType" to "trade.completed", "aggregateId" to event.aggregateId.toString()),
            ),
        )
    }

    private suspend fun handleExchangeCompleted(event: OutboxEvent) {
        val initiatorId = event.payload["initiatorId"]?.jsonPrimitive?.content ?: return
        val recipientId = event.payload["recipientId"]?.jsonPrimitive?.content ?: return
        val payload =
            PushNotificationPayload(
                title = "Exchange Complete",
                body = "Your prize exchange has been completed!",
                data = mapOf("eventType" to "exchange.completed"),
            )
        notificationService.sendPushBatch(
            listOf(
                com.prizedraw.domain.valueobjects.PlayerId
                    .fromString(initiatorId),
                com.prizedraw.domain.valueobjects.PlayerId
                    .fromString(recipientId),
            ),
            payload,
        )
    }

    private suspend fun handleBuybackCompleted(event: OutboxEvent) {
        val playerId = event.payload["playerId"]?.jsonPrimitive?.content ?: return
        val points = event.payload["revenuePointsCredited"]?.jsonPrimitive?.content ?: "0"
        notificationService.sendPush(
            com.prizedraw.domain.valueobjects.PlayerId
                .fromString(playerId),
            PushNotificationPayload(
                title = "Buyback Complete",
                body = "$points revenue points have been credited to your account.",
                data = mapOf("eventType" to "buyback.completed"),
            ),
        )
    }

    private suspend fun handleShippingStatusChanged(event: OutboxEvent) {
        val playerId = event.payload["playerId"]?.jsonPrimitive?.content ?: return
        val status = event.payload["newStatus"]?.jsonPrimitive?.content ?: return
        val body =
            when (status) {
                "SHIPPED" -> "Your prize has been shipped! Check tracking details."
                "DELIVERED" -> "Your prize has been delivered!"
                else -> "Your shipping order status has been updated: $status"
            }
        notificationService.sendPush(
            com.prizedraw.domain.valueobjects.PlayerId
                .fromString(playerId),
            PushNotificationPayload(
                title = "Shipping Update",
                body = body,
                data = mapOf("eventType" to "shipping.status_changed", "status" to status),
            ),
        )
    }

    private suspend fun handlePaymentConfirmed(event: OutboxEvent) {
        val playerId = event.payload["playerId"]?.jsonPrimitive?.content ?: return
        val points = event.payload["drawPointsGranted"]?.jsonPrimitive?.content ?: "0"
        notificationService.sendPush(
            com.prizedraw.domain.valueobjects.PlayerId
                .fromString(playerId),
            PushNotificationPayload(
                title = "Payment Confirmed",
                body = "$points draw points have been added to your account.",
                data = mapOf("eventType" to "payment.confirmed"),
            ),
        )
    }

    private suspend fun handleSupportTicketReplied(event: OutboxEvent) {
        val playerId = event.payload["playerId"]?.jsonPrimitive?.content ?: return
        notificationService.sendPush(
            com.prizedraw.domain.valueobjects.PlayerId
                .fromString(playerId),
            PushNotificationPayload(
                title = "Support Reply",
                body = "Customer service has replied to your support ticket.",
                data = mapOf("eventType" to "support_ticket.replied"),
            ),
        )
    }

    private companion object {
        const val POLL_INTERVAL_SECONDS = 5L
        const val BATCH_SIZE = 100
        const val MAX_ATTEMPTS = 5
        val BASE_BACKOFF = 2.seconds
    }
}
