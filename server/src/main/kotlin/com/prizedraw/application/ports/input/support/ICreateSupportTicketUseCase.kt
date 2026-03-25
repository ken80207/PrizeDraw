package com.prizedraw.application.ports.input.support

import com.prizedraw.contracts.enums.SupportTicketCategory
import com.prizedraw.domain.entities.SupportTicket
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for creating a new customer support ticket.
 *
 * Creates a [SupportTicket] in OPEN status and inserts the player's opening message
 * as the first [com.prizedraw.domain.entities.SupportTicketMessage].
 */
public interface ICreateSupportTicketUseCase {
    /**
     * Creates a new support ticket with an initial player message.
     *
     * @param playerId The authenticated player submitting the ticket.
     * @param category Classification of the issue.
     * @param subject Short one-line description (max 255 characters).
     * @param body Full description of the issue (opening message body).
     * @return The newly created [SupportTicket].
     */
    public suspend fun execute(
        playerId: PlayerId,
        category: SupportTicketCategory,
        subject: String,
        body: String,
    ): SupportTicket
}
