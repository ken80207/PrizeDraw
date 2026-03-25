package com.prizedraw.application.ports.input.support

import com.prizedraw.domain.entities.SupportTicket
import com.prizedraw.domain.entities.SupportTicketMessage
import java.util.UUID

/** Aggregated view of a support ticket and its messages. */
public data class SupportTicketDetail(
    val ticket: SupportTicket,
    val messages: List<SupportTicketMessage>,
)

/**
 * Input port for retrieving a support ticket with its full message history.
 */
public interface IGetSupportTicketDetailUseCase {
    /**
     * Returns the ticket and all its messages ordered by creation time ascending.
     *
     * @param ticketId The ticket identifier.
     * @return The [SupportTicketDetail], or null if the ticket does not exist.
     */
    public suspend fun execute(ticketId: UUID): SupportTicketDetail?
}
