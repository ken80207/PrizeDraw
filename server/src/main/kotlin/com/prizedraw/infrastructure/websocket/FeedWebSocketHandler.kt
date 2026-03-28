package com.prizedraw.infrastructure.websocket

import com.prizedraw.application.ports.output.IPubSubService
import io.ktor.server.routing.Route
import io.ktor.server.websocket.webSocket
import io.ktor.websocket.Frame
import io.ktor.websocket.WebSocketSession
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.ClosedReceiveChannelException
import kotlinx.coroutines.launch
import org.slf4j.LoggerFactory
import java.util.Collections

private val log = LoggerFactory.getLogger("FeedWebSocketHandler")

/**
 * WebSocket endpoint for the live draw feed.
 *
 * All connected clients receive every draw event published on the `feed:draws`
 * Redis pub/sub channel. Filtering is done client-side. No authentication required
 * (public feed).
 *
 * A single background coroutine subscribes to the Redis channel and fans out each
 * incoming message to all currently connected sessions. Dead sessions detected during
 * fan-out are pruned from the set.
 *
 * @param pubSub The pub/sub service used to subscribe to the `feed:draws` channel.
 * @param appScope A [CoroutineScope] tied to the application lifecycle (e.g. the Ktor
 *   [io.ktor.server.application.Application] itself). The subscription coroutine is launched
 *   as a child of this scope so it is cancelled cleanly on application shutdown.
 */
public fun Route.feedWebSocketHandler(
    pubSub: IPubSubService,
    appScope: CoroutineScope,
) {
    val sessions: MutableSet<WebSocketSession> =
        Collections.synchronizedSet(mutableSetOf())

    // Subscribe to feed:draws once at route registration time and fan out to all sessions.
    // Launched in appScope so the coroutine is cancelled when the application shuts down.
    appScope.launch {
        pubSub.subscribe("feed:draws").collect { message ->
            val deadSessions = mutableListOf<WebSocketSession>()
            synchronized(sessions) {
                for (session in sessions) {
                    val result = session.outgoing.trySend(Frame.Text(message))
                    if (result.isClosed) {
                        deadSessions.add(session)
                    }
                }
            }
            deadSessions.forEach { sessions.remove(it) }
        }
    }

    webSocket("/ws/feed") {
        sessions.add(this)
        log.info("Feed WebSocket connected, total={}", sessions.size)
        try {
            @Suppress("UnusedPrivateProperty")
            for (ignored in incoming) {
                // Ignore all client-to-server frames — the feed is server-push only.
            }
        } catch (_: ClosedReceiveChannelException) {
            // Normal disconnect — no action required.
        } finally {
            sessions.remove(this)
            log.info("Feed WebSocket disconnected, total={}", sessions.size)
        }
    }
}
