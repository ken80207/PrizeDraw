package com.prizedraw.contracts.dto.notification

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class PushPayloadDto(
    val title: String,
    val body: String,
    val data: Map<String, String>,
)

@Serializable
public data class NotificationDto(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val isRead: Boolean,
    val createdAt: Instant,
)

/** Enum of all server-to-client WebSocket event types on the player notification channel. */
@Serializable
public enum class PlayerWsEventType {
    // Payment
    PAYMENT_CONFIRMED,
    PAYMENT_FAILED,
    PAYMENT_REFUNDED,

    // Draw
    DRAW_COMPLETED,

    // Trade
    TRADE_COMPLETED,
    TRADE_LISTING_SOLD,

    // Exchange
    EXCHANGE_REQUESTED,
    EXCHANGE_COUNTER_PROPOSED,
    EXCHANGE_ACCEPTED,
    EXCHANGE_REJECTED,
    EXCHANGE_COMPLETED,

    // Buyback
    BUYBACK_COMPLETED,

    // Shipping
    SHIPPING_SHIPPED,
    SHIPPING_DELIVERED,

    // Withdrawal
    WITHDRAWAL_APPROVED,
    WITHDRAWAL_TRANSFERRED,
    WITHDRAWAL_REJECTED,

    // Support
    SUPPORT_REPLIED,

    // Account
    PLAYER_LEVEL_UP,

    // System
    BALANCE_UPDATED,

    // Follow
    FOLLOWING_DRAW_STARTED,
    FOLLOWING_RARE_PRIZE_DRAWN,
}

/**
 * Server-to-client message envelope on the player notification WebSocket.
 *
 * Every message carries an [eventType] for client-side routing and optional
 * typed [data] payload. The [notificationId] links to the persisted notification
 * record for mark-read tracking.
 */
@Serializable
public data class PlayerWsMessage(
    val eventType: PlayerWsEventType,
    val notificationId: String? = null,
    val title: String,
    val body: String,
    val data: Map<String, String> = emptyMap(),
    val timestamp: Instant,
)

/** Lightweight balance snapshot pushed after any point mutation. */
@Serializable
public data class BalanceSnapshotDto(
    val drawPointsBalance: Int,
    val revenuePointsBalance: Int,
)
