package com.prizedraw.realtime.ports

import com.prizedraw.domain.entities.QueueEntry
import java.util.UUID

/**
 * Output port for querying [QueueEntry] entities.
 *
 * The realtime-gateway only reads queue state to populate the initial snapshot
 * on WebSocket connect. All queue mutations remain in the Core API.
 */
public interface IQueueEntryRepository {
    /**
     * Returns all non-terminal entries for the queue ordered by position ascending.
     *
     * @param queueId The queue to query.
     * @return Ordered list of active and waiting entries.
     */
    public suspend fun findActiveEntries(queueId: UUID): List<QueueEntry>
}
