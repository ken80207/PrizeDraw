package com.prizedraw.application.ports.output

import com.prizedraw.contracts.enums.SupportTicketStatus
import com.prizedraw.domain.entities.SupportTicket
import com.prizedraw.domain.entities.SupportTicketMessage
import com.prizedraw.domain.entities.SupportTicketPriority
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Output port for persisting and querying [SupportTicket] and [SupportTicketMessage] entities.
 */
public interface ISupportRepository {
    // --- Support Tickets ---

    /**
     * Finds a [SupportTicket] by its surrogate primary key.
     *
     * @param id The ticket identifier.
     * @return The matching [SupportTicket], or null if not found.
     */
    public suspend fun findTicketById(id: UUID): SupportTicket?

    /**
     * Returns all tickets submitted by the given player, ordered by creation time descending.
     *
     * @param playerId The player's identifier.
     * @param offset Zero-based record offset for pagination.
     * @param limit Maximum number of records to return.
     * @return A page of support tickets for this player.
     */
    public suspend fun findTicketsByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<SupportTicket>

    /**
     * Returns open and in-progress tickets for the back-office queue, ordered by priority then age.
     *
     * @param status When non-null, restricts results to this status.
     * @param priority When non-null, restricts results to this priority level.
     * @param assignedToStaffId When non-null, restricts to tickets assigned to this staff member.
     * @param offset Zero-based record offset for pagination.
     * @param limit Maximum number of records to return.
     * @return A filtered, paginated page of support tickets.
     */
    public suspend fun findTicketsForQueue(
        status: SupportTicketStatus? = null,
        priority: SupportTicketPriority? = null,
        assignedToStaffId: UUID? = null,
        offset: Int,
        limit: Int,
    ): List<SupportTicket>

    /**
     * Persists a [SupportTicket] entity (insert or update).
     *
     * @param ticket The ticket to persist.
     * @return The persisted ticket.
     */
    public suspend fun saveTicket(ticket: SupportTicket): SupportTicket

    // --- Support Ticket Messages ---

    /**
     * Returns all messages for the given ticket, ordered by creation time ascending.
     *
     * @param ticketId The parent ticket identifier.
     * @return Ordered list of messages in the ticket's conversation.
     */
    public suspend fun findMessagesByTicket(ticketId: UUID): List<SupportTicketMessage>

    /**
     * Inserts a new [SupportTicketMessage]. Messages are append-only.
     *
     * @param message The message to insert.
     * @return The inserted message.
     */
    public suspend fun saveMessage(message: SupportTicketMessage): SupportTicketMessage
}
