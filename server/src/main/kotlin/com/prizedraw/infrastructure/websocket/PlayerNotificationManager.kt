package com.prizedraw.infrastructure.websocket

import com.prizedraw.infrastructure.external.redis.RedisPubSub
import io.ktor.server.websocket.DefaultWebSocketServerSession
import io.ktor.websocket.Frame
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Per-player WebSocket session registry for the notification channel.
 *
 * Unlike [ConnectionManager] which groups sessions by room key, this manager
 * groups sessions by player ID. Each player may have multiple active sessions
 * (e.g. web + mobile), and all receive the same notification events.
 *
 * Redis pub/sub channel convention: `ws:player:{playerId}`.
 * The first session for a player triggers a subscription; messages from Redis
 * are fanned out to all local sessions for that player.
 */
public class PlayerNotificationManager(
    private val redisPubSub: RedisPubSub,
) {
    private val log = LoggerFactory.getLogger(PlayerNotificationManager::class.java)
    private val sessions = ConcurrentHashMap<UUID, CopyOnWriteArraySet<DefaultWebSocketServerSession>>()
    private val subscribed = ConcurrentHashMap.newKeySet<UUID>()
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /**
     * Registers a session for the given player.
     *
     * Starts a Redis pub/sub subscription for the player if this is the first session.
     *
     * @param playerId The player's unique identifier.
     * @param session The newly connected WebSocket session.
     */
    public fun register(
        playerId: UUID,
        session: DefaultWebSocketServerSession,
    ) {
        sessions.getOrPut(playerId) { CopyOnWriteArraySet() }.add(session)
        if (subscribed.add(playerId)) {
            startSubscription(playerId)
        }
        log.debug("Player {} notification session registered; count={}", playerId, sessionCount(playerId))
    }

    /**
     * Unregisters a session for the given player.
     *
     * Removes the session from the player's session set; no-op if the session was already removed.
     *
     * @param playerId The player whose session is disconnecting.
     * @param session The disconnecting session.
     */
    public fun unregister(
        playerId: UUID,
        session: DefaultWebSocketServerSession,
    ) {
        sessions[playerId]?.remove(session)
        log.debug("Player {} notification session unregistered; remaining={}", playerId, sessionCount(playerId))
    }

    /**
     * Returns the total number of sessions currently connected for [playerId].
     *
     * @param playerId The player to query.
     * @return The connection count, or 0 if no sessions are registered.
     */
    public fun sessionCount(playerId: UUID): Int = sessions[playerId]?.size ?: 0

    /**
     * Sends [message] as a text frame to every session registered for [playerId].
     *
     * Sessions that fail to receive the frame are silently removed.
     *
     * @param playerId The player to broadcast to.
     * @param message The JSON-encoded message payload.
     */
    public suspend fun broadcast(
        playerId: UUID,
        message: String,
    ) {
        val playerSessions = sessions[playerId] ?: return
        val dead = mutableListOf<DefaultWebSocketServerSession>()
        for (session in playerSessions) {
            @Suppress("TooGenericExceptionCaught")
            try {
                session.send(Frame.Text(message))
            } catch (e: Exception) {
                log.warn("Failed to send notification to player {} session; removing: {}", playerId, e.message)
                dead.add(session)
            }
        }
        dead.forEach { playerSessions.remove(it) }
    }

    // --- Private helpers ---

    private fun startSubscription(playerId: UUID) {
        val channel = "ws:player:$playerId"
        val flow = redisPubSub.subscribe(channel)
        scope.launch {
            flow.collect { message ->
                broadcast(playerId, message)
            }
        }
    }
}
