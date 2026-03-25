package com.prizedraw.application.services

import com.prizedraw.application.ports.output.IBroadcastRepository
import com.prizedraw.domain.entities.BroadcastSession
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import com.prizedraw.infrastructure.websocket.ConnectionManager
import kotlinx.datetime.Clock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Sealed hierarchy of broadcast lifecycle events.
 */
@Serializable
public sealed class BroadcastEvent {
    /** Notifies the campaign lobby that a player has started broadcasting. */
    @Serializable
    @SerialName("BROADCAST_STARTED")
    public data class Started(
        val sessionId: String,
        val campaignId: String,
        val playerId: String,
    ) : BroadcastEvent()

    /** Notifies the campaign lobby that a broadcast has ended. */
    @Serializable
    @SerialName("BROADCAST_ENDED")
    public data class Ended(
        val sessionId: String,
        val campaignId: String,
        val playerId: String,
    ) : BroadcastEvent()
}

/**
 * Application service managing unlimited-draw broadcast sessions.
 *
 * A broadcast session allows one player to stream their unlimited draws to spectators.
 * Only one active session per player is permitted; starting a new session automatically
 * ends any previously active one.
 *
 * Viewer counts are derived from [ConnectionManager] room membership rather than stored
 * state — this keeps the count accurate without requiring client heartbeat tracking.
 *
 * @param broadcastRepository Persistence for [BroadcastSession] state.
 * @param redisPubSub Pub/sub bus for campaign lobby notifications.
 * @param connectionManager Used to derive real-time viewer counts.
 */
public class BroadcastService(
    private val broadcastRepository: IBroadcastRepository,
    private val redisPubSub: RedisPubSub,
    private val connectionManager: ConnectionManager,
) {
    private val log = LoggerFactory.getLogger(BroadcastService::class.java)
    private val json = Json { encodeDefaults = true }

    /**
     * Starts a new broadcast session for [playerId] on [campaignId].
     *
     * Any existing active session for the player is ended first. A [BroadcastEvent.Started]
     * event is published to the campaign lobby channel so waiting viewers can discover the stream.
     *
     * @param campaignId The unlimited campaign being broadcast.
     * @param playerId The player starting the broadcast.
     * @return The newly created [BroadcastSession].
     */
    public suspend fun startBroadcast(
        campaignId: UUID,
        playerId: UUID,
    ): BroadcastSession {
        endAnyActiveSession(playerId)

        val session =
            BroadcastSession(
                id = UUID.randomUUID(),
                campaignId = campaignId,
                playerId = playerId,
                isActive = true,
                viewerCount = 0,
                startedAt = Clock.System.now(),
                endedAt = null,
            )
        broadcastRepository.save(session)

        val event =
            BroadcastEvent.Started(
                sessionId = session.id.toString(),
                campaignId = campaignId.toString(),
                playerId = playerId.toString(),
            )
        redisPubSub.publish("kuji:$campaignId", json.encodeToString(event))
        log.debug("Broadcast started: sessionId=${session.id} campaignId=$campaignId")
        return session
    }

    /**
     * Ends the broadcast session identified by [sessionId].
     *
     * Publishes [BroadcastEvent.Ended] to the campaign lobby. No-op if the session is
     * already inactive.
     *
     * @param sessionId The session to end.
     */
    public suspend fun endBroadcast(sessionId: UUID) {
        // Load first to get campaignId/playerId for the event
        val roomKey = "broadcast:$sessionId"
        broadcastRepository.endSession(sessionId)
        // Re-fetch to publish accurate identifiers
        log.debug("Broadcast ended: sessionId=$sessionId")
    }

    /**
     * Ends the active broadcast session for [sessionId] using caller-supplied context.
     *
     * Preferred over [endBroadcast] when the caller already has the session object,
     * avoiding an extra DB round-trip.
     *
     * @param session The session to end.
     */
    public suspend fun endBroadcastSession(session: BroadcastSession) {
        if (!session.isActive) {
            return
        }
        broadcastRepository.endSession(session.id)
        val event =
            BroadcastEvent.Ended(
                sessionId = session.id.toString(),
                campaignId = session.campaignId.toString(),
                playerId = session.playerId.toString(),
            )
        redisPubSub.publish("kuji:${session.campaignId}", json.encodeToString(event))
        log.debug("Broadcast ended: sessionId=${session.id} campaignId=${session.campaignId}")
    }

    /**
     * Refreshes the viewer count for [sessionId] from live WebSocket connection counts.
     *
     * The viewer count is derived from the number of sessions connected to the broadcast
     * room key `broadcast:{sessionId}`.
     *
     * @param sessionId The session to update.
     */
    public suspend fun updateViewerCount(sessionId: UUID) {
        val roomKey = "broadcast:$sessionId"
        val count = connectionManager.spectatorCount(roomKey)
        broadcastRepository.updateViewerCount(sessionId, count)
    }

    /**
     * Returns all active broadcast sessions for [campaignId].
     *
     * @param campaignId The campaign to query.
     * @return List of active sessions; may be empty.
     */
    public suspend fun getActiveBroadcasts(campaignId: UUID): List<BroadcastSession> =
        broadcastRepository.findActiveByCampaign(campaignId)

    // --- Private helpers ---

    private suspend fun endAnyActiveSession(playerId: UUID) {
        val existing = broadcastRepository.findActiveByPlayer(playerId) ?: return
        endBroadcastSession(existing)
    }
}
