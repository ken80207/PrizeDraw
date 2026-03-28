package com.prizedraw.application.events

import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.ports.output.INotificationService
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPubSubService
import com.prizedraw.application.ports.output.PushNotificationPayload
import com.prizedraw.domain.entities.Notification
import com.prizedraw.domain.entities.OutboxEvent
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
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
 * @param pubSub For WebSocket fanout over pub/sub.
 * @param notificationRepository For persisting notification records per player.
 * @param followRepository For querying follower lists during follow event fan-out.
 */
@Suppress("TooManyFunctions")
public class OutboxWorker(
    private val outboxRepository: IOutboxRepository,
    private val notificationService: INotificationService,
    private val pubSub: IPubSubService,
    private val notificationRepository: INotificationRepository,
    private val followRepository: IFollowRepository,
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
     * For every event, identifies the target players, persists a [Notification] record
     * per player, and publishes a WebSocket payload to the player's dedicated channel.
     * Then dispatches to the FCM push handler for the event type.
     */
    @Suppress("CyclomaticComplexMethod")
    private suspend fun dispatch(event: OutboxEvent) {
        // Identify all players who should receive this event
        val playerIds = extractPlayerIds(event)
        val (title, body) = notificationContent(event) ?: (null to null)

        // Persist one notification per player and publish to each player's WS channel
        for (pid in playerIds) {
            val notification =
                if (title != null && body != null) {
                    val n =
                        Notification(
                            playerId = java.util.UUID.fromString(pid),
                            eventType = event.eventType,
                            title = title,
                            body = body,
                            data = event.payload.mapValues { it.value.jsonPrimitive.content },
                        )
                    notificationRepository.save(n)
                    n
                } else {
                    null
                }
            val wsPayload = buildWsPayload(event, notification)
            pubSub.publish("ws:player:$pid", wsPayload)
        }

        // FCM push notification
        when (event.eventType) {
            "draw.completed" -> handleDrawCompleted(event)
            "trade.completed" -> handleTradeCompleted(event)
            "exchange.completed" -> handleExchangeCompleted(event)
            "exchange.requested" -> handleExchangeRequested(event)
            "exchange.counter_proposed" -> handleExchangeCounterProposed(event)
            "exchange.rejected" -> handleExchangeRejected(event)
            "buyback.completed" -> {} // FCM skipped: player initiated action, result shown in-page
            "shipping.status_changed" -> handleShippingStatusChanged(event)
            "payment.confirmed" -> {} // FCM skipped: player is actively waiting for payment result
            "payment.failed" -> handlePaymentFailed(event)
            "withdrawal.status_changed" -> handleWithdrawalStatusChanged(event)
            "support_ticket.replied" -> handleSupportTicketReplied(event)
            "player.level_up" -> handlePlayerLevelUp(event)
            "following.draw_started" -> handleFollowingNotification(event)
            "following.rare_prize_drawn" -> handleFollowingNotification(event)
            else -> log.debug("OutboxEvent type '{}' has no handler; skipping", event.eventType)
        }
    }

    /**
     * Extracts the player IDs that should receive this event.
     *
     * Most events target a single `playerId`; trade and exchange events may
     * target multiple participants.
     */
    private fun extractPlayerIds(event: OutboxEvent): List<String> {
        val payload = event.payload
        return when (event.eventType) {
            "trade.completed" ->
                listOfNotNull(
                    payload["sellerId"]?.jsonPrimitive?.content,
                    payload["buyerId"]?.jsonPrimitive?.content,
                )
            "exchange.completed" ->
                listOfNotNull(
                    payload["initiatorId"]?.jsonPrimitive?.content,
                    payload["recipientId"]?.jsonPrimitive?.content,
                )
            "exchange.requested", "exchange.counter_proposed" ->
                listOfNotNull(
                    payload["recipientId"]?.jsonPrimitive?.content,
                )
            "exchange.rejected" ->
                listOfNotNull(
                    payload["otherPlayerId"]?.jsonPrimitive?.content,
                )
            "following.draw_started", "following.rare_prize_drawn" -> emptyList()
            else ->
                listOfNotNull(
                    payload["playerId"]?.jsonPrimitive?.content,
                )
        }
    }

    /**
     * Returns the (title, body) pair for a notification based on event type,
     * or `null` if the event type does not produce a notification.
     */
    @Suppress("CyclomaticComplexMethod", "LongMethod")
    private fun notificationContent(event: OutboxEvent): Pair<String, String>? {
        val payload = event.payload
        return when (event.eventType) {
            "draw.completed" -> "Draw Complete!" to "You drew a prize! Check your collection."
            "trade.completed" -> "Purchase Complete" to "Your marketplace purchase has been completed!"
            "exchange.completed" -> "Exchange Complete" to "Your prize exchange has been completed!"
            "exchange.requested" -> "Exchange Request" to "You received a new exchange request."
            "exchange.counter_proposed" ->
                "Counter Proposal" to
                    "You received a counter-proposal for your exchange."
            "exchange.rejected" -> "Exchange Rejected" to "Your exchange request was rejected."
            "buyback.completed" -> {
                val points = payload["revenuePointsCredited"]?.jsonPrimitive?.content ?: "0"
                "Buyback Complete" to "$points revenue points have been credited to your account."
            }
            "shipping.status_changed" -> {
                val status = payload["newStatus"]?.jsonPrimitive?.content ?: ""
                val body =
                    when (status) {
                        "SHIPPED" -> "Your prize has been shipped! Check tracking details."
                        "DELIVERED" -> "Your prize has been delivered!"
                        else -> "Your shipping order status has been updated: $status"
                    }
                "Shipping Update" to body
            }
            "payment.confirmed" -> {
                val points = payload["drawPointsGranted"]?.jsonPrimitive?.content ?: "0"
                "Payment Confirmed" to "$points draw points have been added to your account."
            }
            "payment.failed" -> {
                val reason = payload["reason"]?.jsonPrimitive?.content ?: "Unknown error"
                "Payment Failed" to "Your payment could not be processed: $reason"
            }
            "withdrawal.status_changed" -> {
                val status = payload["newStatus"]?.jsonPrimitive?.content ?: ""
                val body =
                    when (status) {
                        "APPROVED" -> "Your withdrawal request has been approved."
                        "TRANSFERRED" -> "Your withdrawal has been transferred to your bank account."
                        "REJECTED" -> "Your withdrawal request was rejected."
                        else -> "Your withdrawal status has been updated: $status"
                    }
                "Withdrawal Update" to body
            }
            "support_ticket.replied" ->
                "Support Reply" to
                    "Customer service has replied to your support ticket."
            "player.level_up" -> {
                val level = payload["newLevel"]?.jsonPrimitive?.content ?: ""
                val tier = payload["newTierName"]?.jsonPrimitive?.content ?: ""
                "Level Up!" to "Congratulations! You reached level $level ($tier)."
            }
            "following.draw_started" -> {
                val nickname = payload["playerNickname"]?.jsonPrimitive?.content ?: ""
                val campaignName = payload["campaignName"]?.jsonPrimitive?.content ?: ""
                "Friend is drawing" to "$nickname is drawing in $campaignName! Come watch!"
            }
            "following.rare_prize_drawn" -> {
                val nickname = payload["playerNickname"]?.jsonPrimitive?.content ?: ""
                val campaignName = payload["campaignName"]?.jsonPrimitive?.content ?: ""
                val prizeName = payload["prizeName"]?.jsonPrimitive?.content ?: ""
                "Friend hit a rare prize!" to "$nickname drew $prizeName in $campaignName!"
            }
            else -> null
        }
    }

    /**
     * Builds the JSON payload published to the player's WebSocket channel.
     */
    private fun buildWsPayload(
        event: OutboxEvent,
        notification: Notification?,
    ): String =
        buildJsonObject {
            put("eventType", event.eventType)
            put("notificationId", notification?.id?.toString() ?: "")
            put("title", notification?.title ?: "")
            put("body", notification?.body ?: "")
            put("data", event.payload)
            put(
                "timestamp",
                kotlinx.datetime.Clock.System
                    .now()
                    .toString()
            )
        }.toString()

    // ── FCM push notification handlers ───────────────────────────────────

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

    private suspend fun handleExchangeRequested(event: OutboxEvent) {
        val recipientId = event.payload["recipientId"]?.jsonPrimitive?.content ?: return
        notificationService.sendPush(
            com.prizedraw.domain.valueobjects.PlayerId
                .fromString(recipientId),
            PushNotificationPayload(
                title = "Exchange Request",
                body = "You received a new exchange request.",
                data = mapOf("eventType" to "exchange.requested"),
            ),
        )
    }

    private suspend fun handleExchangeCounterProposed(event: OutboxEvent) {
        val recipientId = event.payload["recipientId"]?.jsonPrimitive?.content ?: return
        notificationService.sendPush(
            com.prizedraw.domain.valueobjects.PlayerId
                .fromString(recipientId),
            PushNotificationPayload(
                title = "Counter Proposal",
                body = "You received a counter-proposal for your exchange.",
                data = mapOf("eventType" to "exchange.counter_proposed"),
            ),
        )
    }

    private suspend fun handleExchangeRejected(event: OutboxEvent) {
        val otherPlayerId = event.payload["otherPlayerId"]?.jsonPrimitive?.content ?: return
        notificationService.sendPush(
            com.prizedraw.domain.valueobjects.PlayerId
                .fromString(otherPlayerId),
            PushNotificationPayload(
                title = "Exchange Rejected",
                body = "Your exchange request was rejected.",
                data = mapOf("eventType" to "exchange.rejected"),
            ),
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

    private suspend fun handlePaymentFailed(event: OutboxEvent) {
        val playerId = event.payload["playerId"]?.jsonPrimitive?.content ?: return
        val reason = event.payload["reason"]?.jsonPrimitive?.content ?: "Unknown error"
        notificationService.sendPush(
            com.prizedraw.domain.valueobjects.PlayerId
                .fromString(playerId),
            PushNotificationPayload(
                title = "Payment Failed",
                body = "Your payment could not be processed: $reason",
                data = mapOf("eventType" to "payment.failed"),
            ),
        )
    }

    private suspend fun handleWithdrawalStatusChanged(event: OutboxEvent) {
        val playerId = event.payload["playerId"]?.jsonPrimitive?.content ?: return
        val status = event.payload["newStatus"]?.jsonPrimitive?.content ?: return
        val body =
            when (status) {
                "APPROVED" -> "Your withdrawal request has been approved."
                "TRANSFERRED" -> "Your withdrawal has been transferred to your bank account."
                "REJECTED" -> "Your withdrawal request was rejected."
                else -> "Your withdrawal status has been updated: $status"
            }
        notificationService.sendPush(
            com.prizedraw.domain.valueobjects.PlayerId
                .fromString(playerId),
            PushNotificationPayload(
                title = "Withdrawal Update",
                body = body,
                data = mapOf("eventType" to "withdrawal.status_changed", "status" to status),
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

    private suspend fun handlePlayerLevelUp(event: OutboxEvent) {
        val playerId = event.payload["playerId"]?.jsonPrimitive?.content ?: return
        val level = event.payload["newLevel"]?.jsonPrimitive?.content ?: ""
        val tier = event.payload["newTierName"]?.jsonPrimitive?.content ?: ""
        notificationService.sendPush(
            com.prizedraw.domain.valueobjects.PlayerId
                .fromString(playerId),
            PushNotificationPayload(
                title = "Level Up!",
                body = "Congratulations! You reached level $level ($tier).",
                data = mapOf("eventType" to "player.level_up"),
            ),
        )
    }

    /**
     * Handles fan-out of follow notifications (draw_started and rare_prize_drawn).
     *
     * Queries follower IDs in cursor-based batches of [FANOUT_BATCH_SIZE],
     * bulk-inserts [Notification] records, publishes WebSocket payloads,
     * and sends FCM push batches. Runs in a dedicated coroutine so the
     * outbox worker is not blocked during large fan-outs.
     */
    @Suppress("TooGenericExceptionCaught")
    private fun handleFollowingNotification(event: OutboxEvent) {
        val payload = event.payload
        val playerId = payload["playerId"]?.jsonPrimitive?.content ?: return
        val playerUUID = java.util.UUID.fromString(playerId)
        val (title, body) = notificationContent(event) ?: return

        scope.launch {
            try {
                var cursor: java.util.UUID? = null
                do {
                    val batch = followRepository.findFollowerIdsBatch(playerUUID, cursor, FANOUT_BATCH_SIZE)
                    if (batch.isEmpty()) {
                        break
                    }

                    // batch is List<Pair<followId, followerId>>
                    val followerIds = batch.map { it.second }

                    // Bulk insert notifications
                    val notifications =
                        followerIds.map { followerId ->
                            Notification(
                                playerId = followerId,
                                eventType = event.eventType,
                                title = title,
                                body = body,
                                data = event.payload.mapValues { it.value.jsonPrimitive.content },
                                dedupKey = "${event.id}:$followerId",
                            )
                        }
                    notificationRepository.batchInsertIgnore(notifications)

                    // Publish WS payload per follower
                    for (i in followerIds.indices) {
                        val wsPayload = buildWsPayload(event, notifications[i])
                        pubSub.publish("ws:player:${followerIds[i]}", wsPayload)
                    }

                    // FCM push batch
                    val pushPayload =
                        PushNotificationPayload(
                            title = title,
                            body = body,
                            data = mapOf("eventType" to event.eventType, "playerId" to playerId),
                        )
                    val playerIdValues = followerIds.map { PlayerId(it) }
                    notificationService.sendPushBatch(
                        playerIdValues,
                        pushPayload,
                    )

                    // Advance cursor to the last followId in this batch
                    cursor = batch.last().first
                } while (batch.size == FANOUT_BATCH_SIZE)

                log.debug("Follow fan-out completed for event {} (player {})", event.id, playerId)
            } catch (e: Exception) {
                log.error("Follow fan-out failed for event {} (player {}): {}", event.id, playerId, e.message, e)
            }
        }
    }

    private companion object {
        const val POLL_INTERVAL_SECONDS = 5L
        const val BATCH_SIZE = 100
        const val FANOUT_BATCH_SIZE = 500
        const val MAX_ATTEMPTS = 5
        val BASE_BACKOFF = 2.seconds
    }
}
