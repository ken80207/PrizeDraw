package com.prizedraw.infrastructure.external.push

import com.google.auth.oauth2.GoogleCredentials
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.Message
import com.google.firebase.messaging.MulticastMessage
import com.google.firebase.messaging.Notification
import com.prizedraw.application.ports.output.INotificationService
import com.prizedraw.application.ports.output.PushNotificationPayload
import com.prizedraw.domain.valueobjects.PlayerId
import org.slf4j.LoggerFactory
import java.io.FileInputStream

/**
 * Firebase Cloud Messaging (FCM) implementation of [INotificationService].
 *
 * Initialization reads the service account credentials from the path specified in
 * [FirebaseConfig.serviceAccountPath]. FCM tokens are looked up from the player's
 * device registry — in this stub, the token lookup is a placeholder that should be
 * replaced by a real player-device token store (e.g. a `player_devices` table).
 *
 * All delivery failures are logged and swallowed; push notifications are best-effort.
 */
public class FirebaseNotificationService(
    private val config: FirebaseConfig,
) : INotificationService {
    public data class FirebaseConfig(
        /** Path to the Firebase service account JSON file. */
        val serviceAccountPath: String,
        /** The Firebase project ID. */
        val projectId: String,
    )

    private val log = LoggerFactory.getLogger(FirebaseNotificationService::class.java)

    private val messaging: FirebaseMessaging by lazy {
        if (FirebaseApp.getApps().isEmpty()) {
            val serviceAccount = FileInputStream(config.serviceAccountPath)
            val options =
                FirebaseOptions
                    .builder()
                    .setCredentials(GoogleCredentials.fromStream(serviceAccount))
                    .setProjectId(config.projectId)
                    .build()
            FirebaseApp.initializeApp(options)
        }
        FirebaseMessaging.getInstance()
    }

    @Suppress("TooGenericExceptionCaught")
    override suspend fun sendPush(
        playerId: PlayerId,
        payload: PushNotificationPayload,
    ) {
        val token =
            lookupFcmToken(playerId) ?: run {
                log.debug("No FCM token found for player {}; skipping push", playerId)
                return
            }

        try {
            val message =
                Message
                    .builder()
                    .setToken(token)
                    .setNotification(
                        Notification
                            .builder()
                            .setTitle(payload.title)
                            .setBody(payload.body)
                            .build(),
                    ).putAllData(payload.data)
                    .build()
            messaging.send(message)
            log.debug("Push notification sent to player {}", playerId)
        } catch (e: Exception) {
            log.error("Failed to send push notification to player {}: {}", playerId, e.message)
        }
    }

    @Suppress("TooGenericExceptionCaught")
    override suspend fun sendPushBatch(
        playerIds: List<PlayerId>,
        payload: PushNotificationPayload,
    ) {
        val tokens = playerIds.mapNotNull { lookupFcmToken(it) }
        if (tokens.isEmpty()) {
            log.debug("No FCM tokens found for batch of {} players; skipping", playerIds.size)
            return
        }

        try {
            val message =
                MulticastMessage
                    .builder()
                    .addAllTokens(tokens)
                    .setNotification(
                        Notification
                            .builder()
                            .setTitle(payload.title)
                            .setBody(payload.body)
                            .build(),
                    ).putAllData(payload.data)
                    .build()
            val response = messaging.sendEachForMulticast(message)
            log.debug(
                "Batch push: {} success, {} failure out of {} tokens",
                response.successCount,
                response.failureCount,
                tokens.size,
            )
        } catch (e: Exception) {
            log.error("Failed to send batch push notification: {}", e.message)
        }
    }

    /**
     * Looks up the FCM device token for the given player.
     *
     * Stub implementation — returns null until a `player_devices` table and registration
     * endpoint are implemented. Replace with a real DB lookup in a future phase.
     */
    @Suppress("FunctionOnlyReturningConstant", "UnusedParameter")
    private fun lookupFcmToken(
        @Suppress("UNUSED_PARAMETER") playerId: PlayerId,
    ): String? = null
}
