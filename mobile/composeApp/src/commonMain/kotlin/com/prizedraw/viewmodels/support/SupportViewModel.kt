package com.prizedraw.viewmodels.support

import com.prizedraw.viewmodels.base.BaseViewModel

// ---------------------------------------------------------------------------
// DTOs — will be replaced by api-contracts shared types once T170 lands.
// ---------------------------------------------------------------------------

/**
 * Lightweight representation of a support ticket in the list view.
 *
 * @property id Server-assigned UUID.
 * @property category Ticket category (e.g. TRADE_DISPUTE, DRAW_ISSUE).
 * @property subject One-line summary provided by the player.
 * @property status Lifecycle status (OPEN, IN_PROGRESS, RESOLVED, CLOSED).
 * @property lastMessagePreview Truncated last message body for list-row preview.
 * @property updatedAt ISO-8601 timestamp of the last update.
 */
public data class SupportTicketSummaryDto(
    val id: String,
    val category: String,
    val subject: String,
    val status: String,
    val lastMessagePreview: String?,
    val updatedAt: String,
)

/**
 * Single message within a ticket thread.
 *
 * @property id Server-assigned UUID.
 * @property authorType Either "PLAYER" or "STAFF".
 * @property body Message text.
 * @property createdAt ISO-8601 creation timestamp.
 */
public data class TicketMessageDto(
    val id: String,
    val authorType: String,
    val body: String,
    val createdAt: String,
)

/**
 * Full ticket detail including the full message thread.
 *
 * @property satisfactionScore Player-submitted score 1–5, null if not yet rated.
 */
public data class SupportTicketDetailDto(
    val id: String,
    val category: String,
    val subject: String,
    val status: String,
    val messages: List<TicketMessageDto>,
    val satisfactionScore: Int?,
    val createdAt: String,
    val updatedAt: String,
)

// ---------------------------------------------------------------------------
// MVI State
// ---------------------------------------------------------------------------

/**
 * Full MVI state for the support feature.
 *
 * @property tickets Paginated list of the player's tickets (list screen).
 * @property selectedTicket Full detail of the currently open ticket, null on list screen.
 * @property messages Convenience alias for [selectedTicket]?.messages.
 * @property isLoading True while any async operation is in-flight.
 * @property error Human-readable error message, null when no error.
 */
public data class SupportState(
    val tickets: List<SupportTicketSummaryDto> = emptyList(),
    val selectedTicket: SupportTicketDetailDto? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
) {
    /** Shorthand accessor so screens don't need to null-chain into [selectedTicket]. */
    val messages: List<TicketMessageDto>
        get() = selectedTicket?.messages ?: emptyList()
}

// ---------------------------------------------------------------------------
// MVI Intents
// ---------------------------------------------------------------------------

/** All actions that can be dispatched on the support feature. */
public sealed class SupportIntent {
    /** Load the player's ticket list from GET /api/v1/support/tickets. */
    public data object LoadTickets : SupportIntent()

    /**
     * Load a single ticket's full detail from GET /api/v1/support/tickets/{id}.
     *
     * @property id UUID of the ticket to load.
     */
    public data class LoadTicketDetail(
        val id: String,
    ) : SupportIntent()

    /**
     * Create a new support ticket via POST /api/v1/support/tickets.
     *
     * @property category One of the [TicketCategory] enum values.
     * @property subject One-line summary.
     * @property body Full description of the issue.
     */
    public data class CreateTicket(
        val category: String,
        val subject: String,
        val body: String,
    ) : SupportIntent()

    /**
     * Send a reply message via POST /api/v1/support/tickets/{ticketId}/messages.
     *
     * @property ticketId UUID of the ticket to reply to.
     * @property body Reply message text.
     */
    public data class Reply(
        val ticketId: String,
        val body: String,
    ) : SupportIntent()

    /**
     * Submit a satisfaction rating via PATCH /api/v1/support/tickets/{ticketId}/satisfaction.
     *
     * @property ticketId UUID of the closed/resolved ticket.
     * @property score Integer score 1–5.
     */
    public data class RateSatisfaction(
        val ticketId: String,
        val score: Int,
    ) : SupportIntent()
}

// ---------------------------------------------------------------------------
// ViewModel
// ---------------------------------------------------------------------------

/**
 * MVI ViewModel for the support feature (ticket list, detail, create, reply, rating).
 *
 * TODO(T170): Implement each intent branch:
 *   - [SupportIntent.LoadTickets]: GET /api/v1/support/tickets → setState(tickets=…)
 *   - [SupportIntent.LoadTicketDetail]: GET /api/v1/support/tickets/{id} → setState(selectedTicket=…)
 *   - [SupportIntent.CreateTicket]: POST /api/v1/support/tickets → reload list + navigate to detail
 *   - [SupportIntent.Reply]: POST /api/v1/support/tickets/{id}/messages → reload selectedTicket
 *   - [SupportIntent.RateSatisfaction]: PATCH /api/v1/support/tickets/{id}/satisfaction → update score
 */
public class SupportViewModel : BaseViewModel<SupportState, SupportIntent>(SupportState()) {
    override fun onIntent(intent: SupportIntent) {
        TODO(
            "T170: implement MVI dispatch — LoadTickets, LoadTicketDetail, " +
                "CreateTicket, Reply, RateSatisfaction",
        )
    }
}
