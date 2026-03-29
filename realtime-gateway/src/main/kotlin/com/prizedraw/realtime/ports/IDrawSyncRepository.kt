package com.prizedraw.realtime.ports

import com.prizedraw.domain.entities.DrawSyncSession
import java.util.UUID

/**
 * Persistence port for [DrawSyncSession].
 *
 * Stores the hidden pre-computed draw result alongside the animation progress. The result
 * fields must never be exposed via the WebSocket layer until [markRevealed] is called.
 */
public interface IDrawSyncRepository {
    /**
     * Persists a new draw sync session.
     *
     * @param session The session to save.
     * @return The saved session.
     */
    public suspend fun save(session: DrawSyncSession): DrawSyncSession

    /**
     * Returns the draw sync session with the given [id], or `null` if not found.
     *
     * @param id Session identifier.
     */
    public suspend fun findById(id: UUID): DrawSyncSession?

    /**
     * Returns the active (not yet revealed or cancelled) draw sync session for [playerId],
     * or `null` if the player has no in-flight draw.
     *
     * @param playerId The player to query.
     */
    public suspend fun findActiveByPlayer(playerId: UUID): DrawSyncSession?

    /**
     * Persists the latest animation progress for a session.
     *
     * @param id Session identifier.
     * @param progress Progress value in the range 0.0–1.0.
     */
    public suspend fun updateProgress(
        id: UUID,
        progress: Float,
    )

    /**
     * Marks the session as revealed and records [revealedAt].
     *
     * @param id Session identifier.
     */
    public suspend fun markRevealed(id: UUID)

    /**
     * Marks the session as cancelled and records [cancelledAt].
     *
     * @param id Session identifier.
     */
    public suspend fun markCancelled(id: UUID)
}
