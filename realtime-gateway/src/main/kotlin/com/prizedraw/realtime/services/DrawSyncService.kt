package com.prizedraw.realtime.services

import com.prizedraw.domain.entities.DrawSyncSession
import com.prizedraw.realtime.infrastructure.redis.RedisPubSub
import com.prizedraw.realtime.ports.IDrawSyncRepository
import kotlinx.datetime.Clock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Pre-computed draw result supplied by the caller before animation begins.
 *
 * @param grade Prize grade (e.g. "A", "B", "C", "LAST").
 * @param prizeName Localized prize name.
 * @param photoUrl Optional URL to the prize photo.
 * @param prizeInstanceId The specific prize instance created for this draw.
 */
public data class DrawResult(
    val grade: String,
    val prizeName: String,
    val photoUrl: String?,
    val prizeInstanceId: UUID,
)

/**
 * Sealed hierarchy of draw-sync WebSocket events broadcast to spectators.
 */
@Serializable
public sealed class DrawSyncEvent {
    /** Broadcast when a draw animation begins. Contains no result data. */
    @Serializable
    @SerialName("DRAW_STARTED")
    public data class Started(
        val sessionId: String,
        val ticketId: String?,
        val playerId: String,
        val animationMode: String,
    ) : DrawSyncEvent()

    /** Broadcast as the drawing player reports animation progress. */
    @Serializable
    @SerialName("DRAW_PROGRESS")
    public data class Progress(
        val sessionId: String,
        val progress: Float,
    ) : DrawSyncEvent()

    /** Broadcast when the drawing player cancels mid-animation. */
    @Serializable
    @SerialName("DRAW_CANCELLED")
    public data class Cancelled(
        val sessionId: String,
    ) : DrawSyncEvent()

    /**
     * Broadcast when the draw is complete and the result is safe to reveal.
     *
     * This event is published only after [DrawSyncService.completeDraw] is called.
     */
    @Serializable
    @SerialName("DRAW_REVEALED")
    public data class Revealed(
        val sessionId: String,
        val ticketId: String?,
        val grade: String,
        val prizeName: String,
        val photoUrl: String?,
    ) : DrawSyncEvent()
}

/**
 * Application service coordinating spectator sync for in-progress draw animations.
 *
 * The anti-spoiler mechanism:
 * 1. The caller supplies a [DrawResult] at [startDraw] time — stored in the DB but
 *    **not** included in the [DrawSyncEvent.Started] broadcast.
 * 2. [relayProgress] fans out [DrawSyncEvent.Progress] events as the client reports progress.
 * 3. [completeDraw] marks the session revealed and **only then** broadcasts [DrawSyncEvent.Revealed].
 *
 * @param drawSyncRepository Persistence for [DrawSyncSession] state.
 * @param redisPubSub Pub/sub bus for cross-pod spectator fanout.
 */
public class DrawSyncService(
    private val drawSyncRepository: IDrawSyncRepository,
    private val redisPubSub: RedisPubSub,
) {
    private val log = LoggerFactory.getLogger(DrawSyncService::class.java)
    private val json = Json { encodeDefaults = true }

    /**
     * Starts a draw animation session, storing the pre-computed result and broadcasting
     * [DrawSyncEvent.Started] to all campaign spectators — without the result.
     *
     * @param playerId The player performing the draw.
     * @param ticketId Kuji ticket identifier; `null` for unlimited draws.
     * @param campaignId The campaign the draw belongs to.
     * @param animationMode Client animation type.
     * @param preComputedResult The prize outcome resolved before the animation starts.
     * @return The newly created [DrawSyncSession].
     */
    public suspend fun startDraw(
        playerId: UUID,
        ticketId: UUID?,
        campaignId: UUID,
        animationMode: String,
        preComputedResult: DrawResult,
    ): DrawSyncSession {
        val session =
            DrawSyncSession(
                id = UUID.randomUUID(),
                ticketId = ticketId,
                campaignId = campaignId,
                playerId = playerId,
                animationMode = animationMode,
                resultGrade = preComputedResult.grade,
                resultPrizeName = preComputedResult.prizeName,
                resultPhotoUrl = preComputedResult.photoUrl,
                resultPrizeInstanceId = preComputedResult.prizeInstanceId,
                progress = 0f,
                isRevealed = false,
                isCancelled = false,
                startedAt = Clock.System.now(),
                revealedAt = null,
                cancelledAt = null,
            )
        drawSyncRepository.save(session)
        val event =
            DrawSyncEvent.Started(
                sessionId = session.id.toString(),
                ticketId = ticketId?.toString(),
                playerId = playerId.toString(),
                animationMode = animationMode,
            )
        publishEvent(campaignId, event)
        log.debug("Draw sync started: sessionId={} campaignId={}", session.id, campaignId)
        return session
    }

    /**
     * Relays animation progress from the drawing player to all spectators.
     *
     * No-op if the session is already terminal (revealed or cancelled).
     *
     * @param sessionId The draw sync session.
     * @param progress Progress value in the range 0.0–1.0.
     */
    public suspend fun relayProgress(
        sessionId: UUID,
        progress: Float,
    ) {
        val session = drawSyncRepository.findById(sessionId) ?: return
        if (session.isRevealed || session.isCancelled) {
            return
        }
        drawSyncRepository.updateProgress(sessionId, progress)
        val event = DrawSyncEvent.Progress(sessionId = sessionId.toString(), progress = progress)
        publishEvent(session.campaignId, event)
    }

    /**
     * Cancels an in-progress draw and notifies spectators.
     *
     * @param sessionId The draw sync session to cancel.
     */
    public suspend fun cancelDraw(sessionId: UUID) {
        val session = drawSyncRepository.findById(sessionId) ?: return
        if (session.isRevealed) {
            return
        }
        drawSyncRepository.markCancelled(sessionId)
        val event = DrawSyncEvent.Cancelled(sessionId = sessionId.toString())
        publishEvent(session.campaignId, event)
        log.debug("Draw sync cancelled: sessionId={}", sessionId)
    }

    /**
     * Completes the draw animation and reveals the pre-computed result to all spectators.
     *
     * @param sessionId The draw sync session to complete.
     * @return The completed session with result fields populated.
     * @throws IllegalStateException if the session is not found or has been cancelled.
     */
    public suspend fun completeDraw(sessionId: UUID): DrawSyncSession {
        val session =
            drawSyncRepository.findById(sessionId)
                ?: error("Draw sync session not found: $sessionId")
        check(!session.isCancelled) { "Cannot complete a cancelled draw: $sessionId" }
        drawSyncRepository.markRevealed(sessionId)
        val event =
            DrawSyncEvent.Revealed(
                sessionId = sessionId.toString(),
                ticketId = session.ticketId?.toString(),
                grade = requireNotNull(session.resultGrade) { "resultGrade missing on session $sessionId" },
                prizeName = requireNotNull(session.resultPrizeName) { "resultPrizeName missing on session $sessionId" },
                photoUrl = session.resultPhotoUrl,
            )
        publishEvent(session.campaignId, event)
        log.debug("Draw sync revealed: sessionId={} grade={}", sessionId, session.resultGrade)
        return session
    }

    /**
     * Relays a raw touch-coordinate frame to all campaign spectators without any DB write.
     *
     * @param sessionId The draw sync session the gesture belongs to.
     * @param campaignId The campaign whose spectators should receive the frame.
     * @param x Normalised horizontal touch position (0.0–1.0).
     * @param y Normalised vertical touch position (0.0–1.0).
     * @param isDown `true` while the pointer is in contact with the surface.
     * @param timestamp Client-side epoch milliseconds at frame capture time.
     */
    public suspend fun relayTouchInput(
        sessionId: UUID,
        campaignId: UUID,
        x: Float,
        y: Float,
        isDown: Boolean,
        timestamp: Long,
    ) {
        val payload =
            buildJsonObject {
                put("type", "DRAW_INPUT")
                put("sessionId", sessionId.toString())
                put("x", x)
                put("y", y)
                put("isDown", isDown)
                put("timestamp", timestamp)
            }.toString()
        redisPubSub.publish("kuji:$campaignId", payload)
    }

    // --- Private helpers ---

    private suspend fun publishEvent(
        campaignId: UUID,
        event: DrawSyncEvent,
    ) {
        val payload = json.encodeToString(event)
        redisPubSub.publish("kuji:$campaignId", payload)
    }
}
