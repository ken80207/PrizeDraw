package com.prizedraw.domain.entities

import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A persisted notification record for a player.
 *
 * Notifications are created when domain events occur (e.g. payment confirmed, prize drawn)
 * and are delivered to the player via WebSocket push and/or FCM. Once delivered they remain
 * stored so the player can view their notification history.
 *
 * @property id Surrogate primary key.
 * @property playerId The player this notification belongs to.
 * @property eventType Dot-namespaced event type key, e.g. `payment.confirmed`.
 * @property title Short notification title shown in the notification list.
 * @property body Full notification body text.
 * @property data Optional key-value metadata attached to the notification.
 * @property isRead Whether the player has acknowledged this notification.
 * @property createdAt Creation timestamp.
 */
public data class Notification(
    val id: UUID = UUID.randomUUID(),
    val playerId: UUID,
    val eventType: String,
    val title: String,
    val body: String,
    val data: Map<String, String> = emptyMap(),
    val isRead: Boolean = false,
    val createdAt: Instant = Clock.System.now(),
)
