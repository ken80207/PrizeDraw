package com.prizedraw.infrastructure.websocket

import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.services.TokenService
import com.prizedraw.contracts.endpoints.WebSocketEndpoints
import io.ktor.server.routing.Route
import io.ktor.server.websocket.webSocket
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.slf4j.LoggerFactory

private val log = LoggerFactory.getLogger("PlayerNotificationHandler")

/**
 * WebSocket route handler for the per-player notification channel.
 *
 * Authentication: The client passes a JWT access token as a query parameter `token`
 * (WebSocket does not support custom headers in the browser). The handler verifies
 * the token, extracts the playerId, and registers the session with
 * [PlayerNotificationManager].
 *
 * On connect, the server sends the current unread count so the client can render
 * the notification badge immediately.
 */
public fun Route.playerNotificationHandler(
    playerNotificationManager: PlayerNotificationManager,
    tokenService: TokenService,
    notificationRepository: INotificationRepository,
) {
    webSocket(WebSocketEndpoints.PLAYER_NOTIFICATIONS) {
        // Authenticate via query param (browser WS API doesn't support custom headers)
        val token = call.request.queryParameters["token"]
        if (token == null) {
            close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Missing token"))
            return@webSocket
        }

        // verifyAccessToken returns PlayerId? (null on invalid/expired token, no exception)
        val playerId = tokenService.verifyAccessToken(token)
        if (playerId == null) {
            close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Invalid token"))
            return@webSocket
        }

        // Register session — use playerId.value (UUID) for the manager
        playerNotificationManager.register(playerId.value, this)
        log.info("Player {} connected to notification channel", playerId)

        try {
            // Send initial unread count
            val unreadCount = notificationRepository.countUnread(playerId.value)
            val welcome =
                buildJsonObject {
                    put("eventType", "CONNECTED")
                    put("unreadCount", unreadCount)
                }
            send(Frame.Text(welcome.toString()))

            // Keep the connection alive — read frames to detect disconnect
            for (frame in incoming) {
                if (frame is Frame.Text) {
                    log.debug("Player {} sent: {}", playerId, frame.readText())
                }
            }
        } finally {
            playerNotificationManager.unregister(playerId.value, this)
            log.info("Player {} disconnected from notification channel", playerId)
        }
    }
}
