package com.prizedraw.application.usecases.support

import com.prizedraw.application.ports.input.support.IReplySupportTicketUseCase
import com.prizedraw.application.ports.output.ISupportRepository
import com.prizedraw.contracts.enums.SupportTicketStatus
import com.prizedraw.domain.entities.MessageAttachment
import com.prizedraw.domain.entities.MessageChannel
import com.prizedraw.domain.entities.SupportTicketMessage
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import java.util.UUID

/** Thrown when the support ticket is not found. */
public class SupportTicketNotFoundException(
    ticketId: UUID,
) : IllegalArgumentException("Support ticket $ticketId not found")

/** Thrown when attempting to reply to a closed ticket. */
public class TicketAlreadyClosedException(
    ticketId: UUID,
) : IllegalStateException("Support ticket $ticketId is already closed")

/**
 * Appends a reply to an existing support ticket.
 *
 * Transitions the ticket from OPEN to IN_PROGRESS on the first staff reply.
 * Either [playerId] or [staffId] must be provided — not both, not neither.
 */
public class ReplySupportTicketUseCase(
    private val supportRepository: ISupportRepository,
) : IReplySupportTicketUseCase {
    override suspend fun execute(
        ticketId: UUID,
        playerId: PlayerId?,
        staffId: StaffId?,
        body: String,
    ): SupportTicketMessage {
        require(playerId != null || staffId != null) { "Either playerId or staffId must be provided" }
        require(playerId == null || staffId == null) { "Only one of playerId or staffId may be provided" }
        require(body.isNotBlank()) { "Reply body must not be blank" }
        val ticket =
            supportRepository.findTicketById(ticketId)
                ?: throw SupportTicketNotFoundException(ticketId)
        if (ticket.status == SupportTicketStatus.CLOSED) {
            throw TicketAlreadyClosedException(ticketId)
        }
        val now = Clock.System.now()
        val message =
            SupportTicketMessage(
                id = UUID.randomUUID(),
                supportTicketId = ticketId,
                authorPlayerId = playerId,
                authorStaffId = staffId?.value,
                body = body.trim(),
                attachments = emptyList<MessageAttachment>(),
                channel = MessageChannel.PLATFORM,
                lineMessageId = null,
                createdAt = now,
            )
        val savedMessage = supportRepository.saveMessage(message)
        if (staffId != null && ticket.status == SupportTicketStatus.OPEN) {
            supportRepository.saveTicket(
                ticket.copy(
                    status = SupportTicketStatus.IN_PROGRESS,
                    assignedToStaffId = staffId.value,
                    updatedAt = now,
                ),
            )
        }
        return savedMessage
    }
}
