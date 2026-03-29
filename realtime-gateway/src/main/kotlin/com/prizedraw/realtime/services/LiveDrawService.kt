package com.prizedraw.realtime.services

import com.prizedraw.contracts.dto.livedraw.LiveDrawItemDto
import com.prizedraw.realtime.infrastructure.redis.RedisPubSub
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.slf4j.LoggerFactory
import java.util.concurrent.ConcurrentHashMap

/**
 * Manages the set of active multi-draw sessions and publishes
 * start/end events to the `feed:draws` Redis pub/sub channel.
 *
 * Sessions are tracked in an in-memory [ConcurrentHashMap] keyed by [LiveDrawItemDto.sessionId].
 * Events are broadcast to [CHANNEL] so that all connected `/ws/feed` WebSocket clients receive
 * live-draw presence updates in real time.
 *
 * @param pubSub Pub/sub bus for Redis publishing.
 */
public class LiveDrawService(
    private val pubSub: RedisPubSub,
) {
    private val log = LoggerFactory.getLogger(LiveDrawService::class.java)
    private val activeSessions = ConcurrentHashMap<String, LiveDrawItemDto>()

    /** Returns all currently active live draw sessions. */
    public fun getActiveSessions(): List<LiveDrawItemDto> = activeSessions.values.toList()

    /**
     * Registers a new multi-draw session and broadcasts a `live_draw_started` event.
     *
     * @param item The session metadata to register and broadcast.
     */
    public suspend fun startSession(item: LiveDrawItemDto) {
        activeSessions[item.sessionId] = item
        val payload =
            buildJsonObject {
                put("type", "live_draw_started")
                put("data", Json.encodeToJsonElement(LiveDrawItemDto.serializer(), item))
            }.toString()
        pubSub.publish(CHANNEL, payload)
        log.debug("Live draw started: session={}, player={}", item.sessionId, item.nickname)
    }

    /**
     * Removes a session by [sessionId] and broadcasts a `live_draw_ended` event.
     *
     * If the session does not exist (e.g. already ended), this is a no-op.
     *
     * @param sessionId The identifier of the session to terminate.
     */
    public suspend fun endSession(sessionId: String) {
        val removed = activeSessions.remove(sessionId)
        if (removed != null) {
            val payload =
                buildJsonObject {
                    put("type", "live_draw_ended")
                    put("sessionId", sessionId)
                }.toString()
            pubSub.publish(CHANNEL, payload)
            log.debug("Live draw ended: session={}", sessionId)
        }
    }

    /**
     * Removes all sessions owned by [playerId] and broadcasts a `live_draw_ended` event for each.
     *
     * Intended to clean up when a player disconnects or leaves the draw queue.
     *
     * @param playerId The player whose sessions should be terminated.
     */
    public suspend fun endSessionsByPlayer(playerId: String) {
        val toRemove = activeSessions.values.filter { it.playerId == playerId }
        for (item in toRemove) {
            endSession(item.sessionId)
        }
    }

    private companion object {
        const val CHANNEL = "feed:draws"
    }
}
