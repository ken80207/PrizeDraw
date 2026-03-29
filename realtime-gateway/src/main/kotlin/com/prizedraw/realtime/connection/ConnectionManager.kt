package com.prizedraw.realtime.connection

import com.prizedraw.realtime.infrastructure.redis.RedisPubSub
import io.ktor.server.websocket.DefaultWebSocketServerSession
import io.ktor.websocket.Frame
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Thread-safe registry of active WebSocket sessions grouped by a room key.
 *
 * The room key for kuji boards is `kuji:{campaignId}`; for queue rooms it is
 * `queue:{ticketBoxId}`; for chat rooms it is `chat:{roomId}`. This convention
 * mirrors the Redis pub/sub channel names so that each [RedisPubSub] subscription
 * maps 1-to-1 to a room.
 *
 * For horizontal scaling, a background coroutine subscribes to each new room
 * channel on Redis and fans out inbound messages to all local sessions. When a
 * room becomes empty the subscription is not eagerly cancelled — it will be
 * cleaned up when the next message arrives and finds no sessions.
 *
 * @param redisPubSub The pub/sub bus shared across all handlers.
 */
public class ConnectionManager(
    private val redisPubSub: RedisPubSub,
) {
    private val log = LoggerFactory.getLogger(ConnectionManager::class.java)
    private val rooms = ConcurrentHashMap<String, CopyOnWriteArraySet<DefaultWebSocketServerSession>>()
    private val subscribed = ConcurrentHashMap.newKeySet<String>()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /**
     * Registers a session in the given room.
     *
     * Starts a Redis pub/sub subscription for the room if this is the first session.
     *
     * @param roomKey The room identifier, e.g. `kuji:abc123` or `queue:xyz456`.
     * @param session The newly connected WebSocket session.
     */
    public fun register(
        roomKey: String,
        session: DefaultWebSocketServerSession,
    ) {
        rooms.getOrPut(roomKey) { CopyOnWriteArraySet() }.add(session)
        if (subscribed.add(roomKey)) {
            startSubscription(roomKey)
        }
        log.debug("Session registered in room {}; total={}", roomKey, rooms[roomKey]?.size)
    }

    /**
     * Unregisters a session from its room.
     *
     * @param roomKey The room the session was registered in.
     * @param session The disconnecting session.
     */
    public fun unregister(
        roomKey: String,
        session: DefaultWebSocketServerSession,
    ) {
        rooms[roomKey]?.remove(session)
        log.debug("Session unregistered from room {}; remaining={}", roomKey, rooms[roomKey]?.size)
    }

    /**
     * Returns the total number of sessions currently connected to [roomKey].
     *
     * @param roomKey The room to query.
     * @return The connection count, or 0 if the room does not exist.
     */
    public fun spectatorCount(roomKey: String): Int = rooms[roomKey]?.size ?: 0

    /**
     * Sends [message] as a text frame to every session registered in [roomKey].
     *
     * Sessions that fail to receive the frame are silently removed from the room.
     *
     * @param roomKey The room to broadcast to.
     * @param message The JSON-encoded message payload.
     */
    public suspend fun broadcast(
        roomKey: String,
        message: String,
    ) {
        val sessions = rooms[roomKey] ?: return
        val dead = mutableListOf<DefaultWebSocketServerSession>()
        for (session in sessions) {
            @Suppress("TooGenericExceptionCaught")
            try {
                session.send(Frame.Text(message))
            } catch (e: Exception) {
                log.warn("Failed to send to session in room {}; removing: {}", roomKey, e.message)
                dead.add(session)
            }
        }
        dead.forEach { sessions.remove(it) }
    }

    // --- Private helpers ---

    private fun startSubscription(roomKey: String) {
        scope.launch {
            redisPubSub.subscribe(roomKey).collect { message ->
                broadcast(roomKey, message)
            }
        }
    }
}
