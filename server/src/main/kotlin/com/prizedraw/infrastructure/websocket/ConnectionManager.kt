package com.prizedraw.infrastructure.websocket

import com.prizedraw.infrastructure.external.redis.RedisPubSub
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
 * `queue:{ticketBoxId}`. This convention mirrors the Redis pub/sub channel
 * names so that each [RedisPubSub] subscription maps 1-to-1 to a room.
 *
 * Spectator sessions are also registered under the same `kuji:{campaignId}` key as
 * active-player sessions — all connections receive the same broadcast events. The
 * [spectatorCount] method exposes the total connection count for display purposes.
 *
 * For horizontal scaling, a background coroutine subscribes to each new room
 * channel on Redis and fans out inbound messages to all local sessions. When a
 * room becomes empty the subscription is not eagerly cancelled — it will be
 * cleaned up when the next message arrives and finds no sessions.
 *
 * @param redisPubSub The pub/sub bus shared with the application layer.
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
        log.debug("Session registered in room $roomKey; total=${rooms[roomKey]?.size}")
    }

    /**
     * Unregisters a session from its room.
     *
     * Removes the session from the room set; no-op if the session was already removed.
     *
     * @param roomKey The room the session was registered in.
     * @param session The disconnecting session.
     */
    public fun unregister(
        roomKey: String,
        session: DefaultWebSocketServerSession,
    ) {
        rooms[roomKey]?.remove(session)
        log.debug("Session unregistered from room $roomKey; remaining=${rooms[roomKey]?.size}")
    }

    /**
     * Returns the total number of sessions currently connected to [roomKey].
     *
     * This includes both active-queue players and spectators because all connections
     * are registered under the same room key.
     *
     * @param roomKey The room to query, e.g. `kuji:{campaignId}`.
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
                log.warn("Failed to send to session in room $roomKey; removing", e)
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
