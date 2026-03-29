package com.prizedraw.realtime.ports

import com.prizedraw.domain.entities.Queue
import java.util.UUID

/**
 * Output port for persisting and querying [Queue] entities.
 *
 * Each [com.prizedraw.domain.entities.TicketBox] has exactly one associated [Queue].
 * The queue tracks the active draw session and is the primary concurrency boundary
 * for kuji draws.
 */
public interface IQueueRepository {
    /**
     * Finds the [Queue] associated with the given ticket box.
     *
     * @param ticketBoxId The ticket box identifier.
     * @return The associated [Queue], or null if not yet created.
     */
    public suspend fun findByTicketBoxId(ticketBoxId: UUID): Queue?
}
