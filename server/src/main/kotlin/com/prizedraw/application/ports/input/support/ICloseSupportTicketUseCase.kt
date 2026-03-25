package com.prizedraw.application.ports.input.support

import com.prizedraw.domain.entities.SupportTicket
import com.prizedraw.domain.valueobjects.StaffId
import java.util.UUID

/**
 * Input port for closing a support ticket.
 *
 * Only staff members can close tickets. The player's satisfaction score (1–5) is
 * optionally recorded at closure time.
 */
public interface ICloseSupportTicketUseCase {
    /**
     * Closes the given support ticket and optionally records a satisfaction score.
     *
     * @param ticketId The support ticket to close.
     * @param staffId The staff member performing the closure.
     * @param satisfactionScore Optional player satisfaction rating (1–5). Null if not provided.
     * @return The updated [SupportTicket] in CLOSED status.
     */
    public suspend fun execute(
        ticketId: UUID,
        staffId: StaffId,
        satisfactionScore: Short?,
    ): SupportTicket
}
