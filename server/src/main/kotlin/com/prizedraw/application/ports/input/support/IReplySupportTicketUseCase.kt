package com.prizedraw.application.ports.input.support

import com.prizedraw.domain.entities.SupportTicketMessage
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.StaffId
import java.util.UUID

/**
 * Input port for adding a reply message to an existing support ticket.
 *
 * When a staff member replies for the first time the ticket transitions from OPEN to IN_PROGRESS.
 * Either [playerId] or [staffId] must be provided — exactly one must be non-null.
 */
public interface IReplySupportTicketUseCase {
    /**
     * Appends a reply message to an existing support ticket.
     *
     * @param ticketId The support ticket to reply to.
     * @param playerId The replying player. Null when the author is a staff member.
     * @param staffId The replying staff member. Null when the author is a player.
     * @param body The message content.
     * @return The persisted [SupportTicketMessage].
     */
    public suspend fun execute(
        ticketId: UUID,
        playerId: PlayerId?,
        staffId: StaffId?,
        body: String,
    ): SupportTicketMessage
}
