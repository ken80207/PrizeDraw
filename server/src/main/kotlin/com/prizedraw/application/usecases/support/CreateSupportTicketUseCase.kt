package com.prizedraw.application.usecases.support

import com.prizedraw.application.ports.input.support.ICreateSupportTicketUseCase
import com.prizedraw.application.ports.output.ISupportRepository
import com.prizedraw.contracts.enums.SupportTicketCategory
import com.prizedraw.contracts.enums.SupportTicketStatus
import com.prizedraw.domain.entities.MessageAttachment
import com.prizedraw.domain.entities.MessageChannel
import com.prizedraw.domain.entities.SupportTicket
import com.prizedraw.domain.entities.SupportTicketMessage
import com.prizedraw.domain.entities.SupportTicketPriority
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import java.util.UUID

private const val MAX_SUBJECT_LENGTH = 255

/** Thrown when the ticket subject exceeds the allowed length. */
public class InvalidTicketSubjectException(
    subject: String,
) : IllegalArgumentException("Ticket subject exceeds 255 characters: '$subject'")

/**
 * Creates a [SupportTicket] in OPEN status with the player's opening message.
 *
 * Validates:
 * - [subject] length <= 255 characters
 * - [body] is non-blank
 */
public class CreateSupportTicketUseCase(
    private val supportRepository: ISupportRepository,
) : ICreateSupportTicketUseCase {
    override suspend fun execute(
        playerId: PlayerId,
        category: SupportTicketCategory,
        subject: String,
        body: String,
    ): SupportTicket {
        if (subject.length > MAX_SUBJECT_LENGTH) {
            throw InvalidTicketSubjectException(subject)
        }
        require(body.isNotBlank()) { "Ticket body must not be blank" }
        val now = Clock.System.now()
        val ticketId = UUID.randomUUID()
        val ticket =
            SupportTicket(
                id = ticketId,
                playerId = playerId,
                assignedToStaffId = null,
                category = category,
                subject = subject.trim(),
                status = SupportTicketStatus.OPEN,
                priority = SupportTicketPriority.NORMAL,
                satisfactionScore = null,
                lineThreadId = null,
                contextTradeOrderId = null,
                contextPaymentOrderId = null,
                contextShippingOrderId = null,
                contextWithdrawalId = null,
                resolvedAt = null,
                closedAt = null,
                createdAt = now,
                updatedAt = now,
            )
        val savedTicket = supportRepository.saveTicket(ticket)
        val openingMessage =
            SupportTicketMessage(
                id = UUID.randomUUID(),
                supportTicketId = ticketId,
                authorPlayerId = playerId,
                authorStaffId = null,
                body = body.trim(),
                attachments = emptyList<MessageAttachment>(),
                channel = MessageChannel.PLATFORM,
                lineMessageId = null,
                createdAt = now,
            )
        supportRepository.saveMessage(openingMessage)
        return savedTicket
    }
}
