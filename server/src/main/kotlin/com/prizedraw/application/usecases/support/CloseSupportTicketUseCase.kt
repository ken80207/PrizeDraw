package com.prizedraw.application.usecases.support

import com.prizedraw.application.ports.input.support.ICloseSupportTicketUseCase
import com.prizedraw.application.ports.output.ISupportRepository
import com.prizedraw.contracts.enums.SupportTicketStatus
import com.prizedraw.domain.entities.SupportTicket
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import java.util.UUID

private const val MIN_SATISFACTION_SCORE: Short = 1
private const val MAX_SATISFACTION_SCORE: Short = 5

/** Thrown when the satisfaction score is outside the valid range 1–5. */
public class InvalidSatisfactionScoreException(
    score: Short,
) : IllegalArgumentException("Satisfaction score must be between 1 and 5, got $score")

/**
 * Closes a support ticket and optionally records the player's satisfaction score.
 *
 * Validates:
 * - Ticket must exist.
 * - Ticket must not already be CLOSED.
 * - [satisfactionScore] must be in 1–5 if provided.
 */
public class CloseSupportTicketUseCase(
    private val supportRepository: ISupportRepository,
) : ICloseSupportTicketUseCase {
    override suspend fun execute(
        ticketId: UUID,
        staffId: StaffId,
        satisfactionScore: Short?,
    ): SupportTicket {
        if (satisfactionScore != null && satisfactionScore !in MIN_SATISFACTION_SCORE..MAX_SATISFACTION_SCORE) {
            throw InvalidSatisfactionScoreException(satisfactionScore)
        }
        val ticket =
            supportRepository.findTicketById(ticketId)
                ?: throw SupportTicketNotFoundException(ticketId)
        if (ticket.status == SupportTicketStatus.CLOSED) {
            throw TicketAlreadyClosedException(ticketId)
        }
        val now = Clock.System.now()
        val updated =
            ticket.copy(
                status = SupportTicketStatus.CLOSED,
                satisfactionScore = satisfactionScore,
                closedAt = now,
                updatedAt = now,
            )
        return supportRepository.saveTicket(updated)
    }
}
