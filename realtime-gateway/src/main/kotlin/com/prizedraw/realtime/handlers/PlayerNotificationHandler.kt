package com.prizedraw.realtime.handlers

import com.prizedraw.contracts.endpoints.WebSocketEndpoints
import com.prizedraw.realtime.connection.PlayerNotificationManager
import com.prizedraw.realtime.ports.INotificationRepository
import com.prizedraw.shared.auth.JwtVerifier
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
 * (WebSocket does not support custom headers in browsers). The handler verifies the
 * token locally using [JwtVerifier] from the `:shared` module — no HTTP call to the
 * Core API is made for authentication.
 *
 * On connect, the server sends the current unread count so the client can render
 * the notification badge immediately.
 *
 * @param playerNotificationManager Per-player session registry.
 * @param jwtVerifier LOCAL JWT verifier — shared module, no HTTP calls.
 * @param notificationRepository Used to fetch the initial unread count on connect.
 */
public fun Route.playerNotificationHandler(
    playerNotificationManager: PlayerNotificationManager,
    jwtVerifier: JwtVerifier,
    notificationRepository: INotificationRepository,
) {
    webSocket(WebSocketEndpoints.PLAYER_NOTIFICATIONS) {
        // Authenticate via query param (browser WS API doesn't support custom headers)
        val token = call.request.queryParameters["token"]
        if (token == null) {
            close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Missing token"))
            return@webSocket
        }

        // verifyPlayerToken returns PlayerClaims? (null on invalid/expired token, no exception)
        val claims = jwtVerifier.verifyPlayerToken(token)
        if (claims == null) {
            close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Invalid token"))
            return@webSocket
        }
        val playerId = claims.playerId

        // Register session — use playerId (UUID) for the manager
        playerNotificationManager.register(playerId, this)
        log.info("Player {} connected to notification channel", playerId)

        try {
            // Send initial unread count
            val unreadCount = notificationRepository.countUnread(playerId)
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
            playerNotificationManager.unregister(playerId, this)
            log.info("Player {} disconnected from notification channel", playerId)
        }
    }
}
