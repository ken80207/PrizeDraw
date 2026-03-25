package com.prizedraw.infrastructure.websocket

import com.prizedraw.application.ports.output.IQueueEntryRepository
import com.prizedraw.application.ports.output.IQueueRepository
import com.prizedraw.contracts.endpoints.WebSocketEndpoints
import io.ktor.server.routing.Route
import io.ktor.server.websocket.DefaultWebSocketServerSession
import io.ktor.server.websocket.webSocket
import io.ktor.websocket.CloseReason
import io.ktor.websocket.Frame
import io.ktor.websocket.close
import io.ktor.websocket.readText
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.slf4j.LoggerFactory
import java.util.UUID

private val log = LoggerFactory.getLogger("QueueWebSocketHandler")

/**
 * Registers the `/ws/queue/{ticketBoxId}` WebSocket route.
 *
 * On connect the handler sends the current queue snapshot so the client immediately
 * knows the queue length and active player. Queue state changes are broadcast via
 * [ConnectionManager] which fans out messages from the `queue:{ticketBoxId}` Redis channel.
 *
 * @param connectionManager Manages active sessions per queue room.
 * @param queueRepository Used to load the queue state snapshot on connect.
 * @param queueEntryRepository Used to load the entry list for position calculation.
 */
public fun Route.queueWebSocketHandler(
    connectionManager: ConnectionManager,
    queueRepository: IQueueRepository,
    queueEntryRepository: IQueueEntryRepository,
) {
    webSocket(WebSocketEndpoints.QUEUE) {
        val ticketBoxId =
            call.parameters["ticketBoxId"] ?: run {
                close(CloseReason(CloseReason.Codes.VIOLATED_POLICY, "Missing ticketBoxId"))
                return@webSocket
            }
        val roomKey = "queue:$ticketBoxId"
        connectionManager.register(roomKey, this)
        try {
            sendQueueSnapshot(ticketBoxId, queueRepository, queueEntryRepository)
            for (frame in incoming) {
                if (frame is Frame.Text) {
                    log.debug("Queue room $ticketBoxId received: ${frame.readText()}")
                }
            }
        } finally {
            connectionManager.unregister(roomKey, this)
            log.debug("Session disconnected from queue room $ticketBoxId")
        }
    }
}

private suspend fun DefaultWebSocketServerSession.sendQueueSnapshot(
    ticketBoxIdStr: String,
    queueRepository: IQueueRepository,
    queueEntryRepository: IQueueEntryRepository,
) {
    val ticketBoxId = runCatching { UUID.fromString(ticketBoxIdStr) }.getOrNull() ?: return
    val queue = queueRepository.findByTicketBoxId(ticketBoxId)
    val entries =
        if (queue != null) {
            queueEntryRepository.findActiveEntries(queue.id)
        } else {
            emptyList()
        }
    val snapshot =
        buildJsonObject {
            put("type", "QUEUE_SNAPSHOT")
            put("ticketBoxId", ticketBoxIdStr)
            put("queueLength", entries.size)
            put("activePlayerId", queue?.activePlayerId?.value?.toString())
            put("sessionExpiresAt", queue?.sessionExpiresAt?.toString())
        }
    send(Frame.Text(snapshot.toString()))
}
