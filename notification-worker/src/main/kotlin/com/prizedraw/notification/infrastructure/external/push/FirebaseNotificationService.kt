package com.prizedraw.notification.infrastructure.external.push

import com.google.auth.oauth2.GoogleCredentials
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import com.google.firebase.messaging.Message
import com.google.firebase.messaging.MulticastMessage
import com.google.firebase.messaging.Notification
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.notification.ports.INotificationService
import com.prizedraw.notification.ports.IPlayerDeviceRepository
import com.prizedraw.notification.ports.PushNotificationPayload
import org.slf4j.LoggerFactory
import java.io.FileInputStream

/**
 * Firebase Cloud Messaging (FCM) implementation of [INotificationService].
 *
 * Initialization reads the service account credentials from the path specified in
 * [FirebaseConfig.serviceAccountPath]. FCM tokens are looked up from the player's
 * device registry via [IPlayerDeviceRepository].
 *
 * All delivery failures are logged and swallowed; push notifications are best-effort.
 *
 * @param config Firebase project configuration.
 * @param playerDeviceRepository Source of FCM device tokens per player.
 */
public class FirebaseNotificationService(
    private val config: FirebaseConfig,
    private val playerDeviceRepository: IPlayerDeviceRepository,
) : INotificationService {
    /**
     * Firebase project configuration.
     *
     * @property serviceAccountPath Filesystem path to the Firebase service account JSON file.
     * @property projectId The Firebase project ID.
     */
    public data class FirebaseConfig(
        val serviceAccountPath: String,
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
        val tokens = playerDeviceRepository.findTokensByPlayerId(playerId.value)
        if (tokens.isEmpty()) {
            log.debug("No FCM tokens found for player {}; skipping push", playerId)
            return
        }
        if (tokens.size == 1) {
            sendToSingleToken(tokens.first(), payload)
        } else {
            sendToMultipleTokens(tokens, payload)
        }
    }

    @Suppress("TooGenericExceptionCaught")
    override suspend fun sendPushBatch(
        playerIds: List<PlayerId>,
        payload: PushNotificationPayload,
    ) {
        val allTokens = playerIds.flatMap { playerDeviceRepository.findTokensByPlayerId(it.value) }
        if (allTokens.isEmpty()) {
            log.debug("No FCM tokens found for batch of {} players; skipping", playerIds.size)
            return
        }
        sendToMultipleTokens(allTokens, payload)
    }

    @Suppress("TooGenericExceptionCaught")
    private fun sendToSingleToken(
        token: String,
        payload: PushNotificationPayload,
    ) {
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
            log.debug("Push notification sent to single token")
        } catch (e: Exception) {
            log.error("Failed to send push notification to token: {}", e.message)
        }
    }

    @Suppress("TooGenericExceptionCaught")
    private fun sendToMultipleTokens(
        tokens: List<String>,
        payload: PushNotificationPayload,
    ) {
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
}
