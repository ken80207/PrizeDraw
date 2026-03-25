package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.SupportTicketCategory
import com.prizedraw.contracts.enums.SupportTicketStatus
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Priority level for a [SupportTicket].
 */
public enum class SupportTicketPriority {
    LOW,
    NORMAL,
    HIGH,
    URGENT,
}

/**
 * Channel through which a [SupportTicketMessage] was sent or received.
 */
public enum class MessageChannel {
    /** Sent through the platform's own messaging interface. */
    PLATFORM,

    /** Sent or received via LINE Official Account. */
    LINE,
}

/**
 * A player-submitted issue report (客服工單).
 *
 * Supports multi-message conversation between the player and customer service staff.
 * Context FK fields ([contextTradeOrderId], [contextPaymentOrderId], etc.) are optional
 * hints that link related entities to help agents resolve issues faster.
 *
 * @property id Surrogate primary key.
 * @property playerId FK to the [Player] who submitted this ticket.
 * @property assignedToStaffId FK to the assigned CS staff agent. Null until assigned.
 * @property category Ticket category classification.
 * @property subject Short description of the issue.
 * @property status Current ticket state.
 * @property priority Urgency level.
 * @property satisfactionScore Player satisfaction rating (1–5). Set only when status is CLOSED.
 * @property lineThreadId LINE conversation thread ID for sync with LINE Official Account.
 * @property contextTradeOrderId Related trade order FK for agent context.
 * @property contextPaymentOrderId Related payment order FK for agent context.
 * @property contextShippingOrderId Related shipping order FK for agent context.
 * @property contextWithdrawalId Related withdrawal request FK for agent context.
 * @property resolvedAt When this ticket was marked resolved.
 * @property closedAt When this ticket was fully closed.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class SupportTicket(
    val id: UUID,
    val playerId: PlayerId,
    val assignedToStaffId: UUID?,
    val category: SupportTicketCategory,
    val subject: String,
    val status: SupportTicketStatus,
    val priority: SupportTicketPriority,
    val satisfactionScore: Short?,
    val lineThreadId: String?,
    val contextTradeOrderId: UUID?,
    val contextPaymentOrderId: UUID?,
    val contextShippingOrderId: UUID?,
    val contextWithdrawalId: UUID?,
    val resolvedAt: Instant?,
    val closedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/**
 * A single message in a [SupportTicket] conversation (工單訊息).
 *
 * Authored by either a player ([authorPlayerId]) or a staff member ([authorStaffId]);
 * exactly one must be non-null. LINE-sourced messages carry a [lineMessageId] for
 * deduplication against duplicate webhook deliveries.
 *
 * Messages are append-only; no UPDATE or DELETE operations are permitted.
 *
 * @property id Surrogate primary key.
 * @property supportTicketId FK to the parent [SupportTicket].
 * @property authorPlayerId FK to the authoring [Player]. Null when authored by staff.
 * @property authorStaffId FK to the authoring Staff. Null when authored by player.
 * @property body Message content text.
 * @property attachments List of attachment URLs with MIME types.
 * @property channel Delivery channel for this message.
 * @property lineMessageId LINE message ID for deduplication. Null for platform messages.
 * @property createdAt Creation timestamp. Immutable.
 */
public data class SupportTicketMessage(
    val id: UUID,
    val supportTicketId: UUID,
    val authorPlayerId: PlayerId?,
    val authorStaffId: UUID?,
    val body: String,
    val attachments: List<MessageAttachment>,
    val channel: MessageChannel,
    val lineMessageId: String?,
    val createdAt: Instant,
)

/**
 * An attachment included in a [SupportTicketMessage].
 *
 * @property url CDN URL of the attachment.
 * @property mimeType MIME type of the attachment content.
 */
public data class MessageAttachment(
    val url: String,
    val mimeType: String,
)
