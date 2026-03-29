package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.QueueEntryStatus
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A single player's presence in a queue.
 *
 * Ordered by [position] (assigned on join). Exactly one entry per queue may be
 * [QueueEntryStatus.ACTIVE] at a time (the current draw session holder);
 * all others are [QueueEntryStatus.WAITING].
 *
 * Terminal states are [QueueEntryStatus.COMPLETED], [QueueEntryStatus.ABANDONED],
 * and [QueueEntryStatus.EVICTED]. Entries in terminal states are retained for
 * history but excluded from active queue computations.
 *
 * @property id Surrogate primary key.
 * @property queueId FK to the parent queue.
 * @property playerId FK to the queued player.
 * @property position 1-based position in queue. 1 = currently drawing or first in line.
 * @property status Current queue position state.
 * @property joinedAt When the player joined the queue.
 * @property activatedAt When this entry's draw session started. Null until activated.
 * @property completedAt When the player voluntarily ended or the session expired. Null until terminal.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class QueueEntry(
    val id: UUID,
    val queueId: UUID,
    val playerId: PlayerId,
    val position: Int,
    val status: QueueEntryStatus,
    val joinedAt: Instant,
    val activatedAt: Instant?,
    val completedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    /** Returns true if this entry is in a terminal state. */
    public fun isTerminal(): Boolean =
        status == QueueEntryStatus.COMPLETED ||
            status == QueueEntryStatus.ABANDONED ||
            status == QueueEntryStatus.EVICTED
}
