package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.QueueEntry
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Output port for persisting and querying [QueueEntry] entities.
 *
 * Entries track each player's position and lifecycle within a [com.prizedraw.domain.entities.Queue].
 * Terminal entries (COMPLETED, ABANDONED, EVICTED) are retained for history.
 */
public interface IQueueEntryRepository {
    /**
     * Finds a [QueueEntry] by its surrogate primary key.
     *
     * @param id The entry identifier.
     * @return The matching [QueueEntry], or null if not found.
     */
    public suspend fun findById(id: UUID): QueueEntry?

    /**
     * Finds the active or waiting entry for a player in the given queue, if any.
     *
     * Returns null when the player has no non-terminal entry in the queue.
     *
     * @param queueId The queue to search.
     * @param playerId The player to look up.
     * @return The player's current non-terminal [QueueEntry], or null.
     */
    public suspend fun findActiveEntry(
        queueId: UUID,
        playerId: PlayerId,
    ): QueueEntry?

    /**
     * Returns all non-terminal entries for the queue ordered by [QueueEntry.position] ascending.
     *
     * @param queueId The queue to query.
     * @return Ordered list of active and waiting entries.
     */
    public suspend fun findActiveEntries(queueId: UUID): List<QueueEntry>

    /**
     * Returns the next WAITING entry by position in the given queue.
     *
     * @param queueId The queue to query.
     * @return The first waiting entry by position, or null if the queue is empty.
     */
    public suspend fun findNextWaiting(queueId: UUID): QueueEntry?

    /**
     * Counts the non-terminal entries ahead of (and including) the given position.
     *
     * Used to report a player's queue position to the client.
     *
     * @param queueId The queue to query.
     * @param position The position to measure from (inclusive).
     * @return The count of entries at or below [position] that are still active/waiting.
     */
    public suspend fun countActiveEntriesBefore(
        queueId: UUID,
        position: Int,
    ): Int

    /**
     * Persists a [QueueEntry] entity (insert or update).
     *
     * @param entry The entry to persist.
     * @return The persisted entry.
     */
    public suspend fun save(entry: QueueEntry): QueueEntry
}
