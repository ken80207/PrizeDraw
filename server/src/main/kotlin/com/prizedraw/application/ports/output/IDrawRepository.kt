package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.DrawTicket
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Output port for persisting and querying [DrawTicket] entities.
 *
 * [DrawTicket] records are largely immutable after the draw event; the only
 * mutation is the atomic transition from AVAILABLE → DRAWN via [markDrawn].
 */
public interface IDrawRepository {
    /**
     * Finds a [DrawTicket] by its surrogate primary key.
     *
     * @param id The draw ticket identifier.
     * @return The matching [DrawTicket], or null if not found.
     */
    public suspend fun findTicketById(id: UUID): DrawTicket?

    /**
     * Returns all [DrawTicket]s in the given box that are still available to draw.
     *
     * Results reflect the current database state; callers must handle the case where the
     * returned list may be stale between the read and a subsequent draw attempt.
     *
     * @param boxId The ticket box to query.
     * @return List of available (not yet drawn) tickets.
     */
    public suspend fun findAvailableTickets(boxId: UUID): List<DrawTicket>

    /**
     * Returns all [DrawTicket]s belonging to the given ticket box.
     *
     * @param boxId The ticket box to query.
     * @return All tickets (available and drawn) for the box.
     */
    public suspend fun findTicketsByBox(boxId: UUID): List<DrawTicket>

    /**
     * Atomically marks a ticket as drawn and records the outcome.
     *
     * This operation must be executed inside the kuji draw transaction alongside the
     * balance debit and prize instance creation.
     *
     * @param ticketId The ticket being drawn.
     * @param playerId The player who drew the ticket.
     * @param prizeInstanceId The prize instance created for this draw.
     * @param at The timestamp of the draw event.
     * @return The updated [DrawTicket] with DRAWN status.
     */
    public suspend fun markDrawn(
        ticketId: UUID,
        playerId: PlayerId,
        prizeInstanceId: PrizeInstanceId,
        at: Instant,
    ): DrawTicket
}
