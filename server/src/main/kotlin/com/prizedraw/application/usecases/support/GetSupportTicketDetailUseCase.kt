package com.prizedraw.application.usecases.support

import com.prizedraw.application.ports.input.support.IGetSupportTicketDetailUseCase
import com.prizedraw.application.ports.input.support.SupportTicketDetail
import com.prizedraw.application.ports.output.ISupportRepository
import java.util.UUID

/**
 * Returns a support ticket and its full message history.
 *
 * Returns null if the ticket does not exist.
 */
public class GetSupportTicketDetailUseCase(
    private val supportRepository: ISupportRepository,
) : IGetSupportTicketDetailUseCase {
    override suspend fun execute(ticketId: UUID): SupportTicketDetail? {
        val ticket = supportRepository.findTicketById(ticketId) ?: return null
        val messages = supportRepository.findMessagesByTicket(ticketId)
        return SupportTicketDetail(ticket = ticket, messages = messages)
    }
}
