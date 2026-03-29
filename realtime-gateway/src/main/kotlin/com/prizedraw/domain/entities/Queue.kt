package com.prizedraw.domain.entities

import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * One persistent queue per ticket box.
 *
 * Tracks the active draw session holder and the ordered waiting list. The queue is
 * the concurrency control boundary for kuji draws: only the player holding the active
 * session ([activePlayerId]) may draw tickets from the associated box.
 *
 * When idle, [activePlayerId], [sessionStartedAt], and [sessionExpiresAt] are all null.
 * When a session is in progress, all three are non-null.
 *
 * @property id Surrogate primary key.
 * @property ticketBoxId FK to the ticket box. Unique — each box has exactly one queue.
 * @property activePlayerId FK to the player currently holding the draw session. Null when idle.
 * @property sessionStartedAt When the current session began. Null when idle.
 * @property sessionExpiresAt `sessionStartedAt + draw_session_seconds`. Null when idle.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class Queue(
    val id: UUID,
    val ticketBoxId: UUID,
    val activePlayerId: PlayerId?,
    val sessionStartedAt: Instant?,
    val sessionExpiresAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    /** Returns true if a draw session is currently in progress. */
    public fun hasActiveSession(): Boolean =
        activePlayerId != null && sessionStartedAt != null && sessionExpiresAt != null

    /** Returns true if the queue is idle (no active draw session). */
    public fun isIdle(): Boolean = !hasActiveSession()
}
