package com.prizedraw.notification.ports

import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Push notification payload carrying a title, body, and optional deep-link data.
 *
 * @property title Notification title displayed in the system tray.
 * @property body Notification body text.
 * @property data Optional key-value map for deep-link routing or custom handling in the app.
 */
public data class PushNotificationPayload(
    val title: String,
    val body: String,
    val data: Map<String, String> = emptyMap(),
)

/**
 * Output port for sending asynchronous push notifications to players.
 *
 * Implementations connect to Firebase Cloud Messaging (FCM). Delivery is best-effort;
 * failures are logged but not surfaced as application-layer errors.
 */
public interface INotificationService {
    /**
     * Sends a push notification to all registered devices of the given player.
     *
     * @param playerId The recipient player's identifier.
     * @param payload The notification content to deliver.
     */
    public suspend fun sendPush(
        playerId: PlayerId,
        payload: PushNotificationPayload,
    )

    /**
     * Sends a push notification to a batch of players.
     *
     * @param playerIds The recipient player identifiers.
     * @param payload The notification content to deliver to all recipients.
     */
    public suspend fun sendPushBatch(
        playerIds: List<PlayerId>,
        payload: PushNotificationPayload,
    )
}
