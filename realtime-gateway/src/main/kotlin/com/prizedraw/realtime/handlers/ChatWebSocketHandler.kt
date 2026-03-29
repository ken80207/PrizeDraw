package com.prizedraw.realtime.handlers

import com.prizedraw.contracts.endpoints.WebSocketEndpoints
import com.prizedraw.domain.entities.ChatMessage
import com.prizedraw.realtime.connection.ConnectionManager
import com.prizedraw.realtime.services.ChatService
import io.ktor.server.routing.Route
import io.ktor.server.websocket.DefaultWebSocketServerSession
import io.ktor.server.websocket.webSocket
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.slf4j.LoggerFactory

private val log = LoggerFactory.getLogger("ChatWebSocketHandler")

/**
 * Registers the `/ws/chat/{roomId}` WebSocket route.
 *
 * On connect:
 * 1. Session is registered in the chat room via [ConnectionManager].
 * 2. Recent chat history is sent as a `CHAT_HISTORY` frame.
 *
 * The chat room key is `chat:{roomId}` — this mirrors the Redis pub/sub channel name
 * used by [ChatService], so [ConnectionManager] automatically fans out published
 * messages to all sessions in the room.
 *
 * Incoming frames are ignored at the WebSocket layer; all message sending is done
 * through the REST API.
 *
 * @param connectionManager Manages active sessions per room.
 * @param chatService Used to fetch recent history on connect.
 */
public fun Route.chatWebSocketHandler(
    connectionManager: ConnectionManager,
    chatService: ChatService,
) {
    webSocket(WebSocketEndpoints.CHAT_ROOM) {
        val roomId =
            call.parameters["roomId"] ?: run {
                close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Missing roomId"))
                return@webSocket
            }
        val chatRoomKey = "chat:$roomId"
        connectionManager.register(chatRoomKey, this)
        try {
            sendChatHistory(roomId, chatService)
            for (frame in incoming) {
                if (frame is Frame.Text) {
                    log.debug("Chat WS {} received (ignored — use REST): {}", roomId, frame.readText())
                }
            }
        } finally {
            connectionManager.unregister(chatRoomKey, this)
            log.debug("Chat session disconnected from room {}", roomId)
        }
    }
}

private suspend fun DefaultWebSocketServerSession.sendChatHistory(
    roomId: String,
    chatService: ChatService,
) {
    val history = chatService.getHistory(roomId, limit = ChatService.DEFAULT_HISTORY_LIMIT)
    val payload =
        buildJsonObject {
            put("type", "CHAT_HISTORY")
            put(
                "messages",
                buildJsonArray {
                    history.forEach { add(it.toHistoryJson()) }
                },
            )
        }
    send(Frame.Text(payload.toString()))
}

private fun ChatMessage.toHistoryJson() =
    buildJsonObject {
        put("playerId", playerId.toString())
        put("nickname", playerNickname)
        put("message", message)
        put("timestamp", createdAt.toString())
        put("isReaction", isReaction)
    }
