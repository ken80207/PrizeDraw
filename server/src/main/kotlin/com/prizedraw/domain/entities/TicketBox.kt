package com.prizedraw.domain.entities

import com.prizedraw.domain.valueobjects.CampaignId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Status of a [TicketBox] draw pool.
 */
public enum class TicketBoxStatus {
    /** Tickets are still available for drawing. */
    AVAILABLE,

    /** All tickets have been drawn; this box is closed. Terminal state. */
    SOLD_OUT,
}

/**
 * A draw pool inside a [KujiCampaign].
 *
 * Each box has a fixed set of [DrawTicket]s and an independent [Queue].
 * Multiple boxes can exist within one campaign; players may switch between boxes
 * during their session window.
 *
 * [remainingTickets] is decremented atomically with each draw within the same
 * database transaction as the [DrawTicket] status update.
 *
 * @property id Surrogate primary key.
 * @property kujiCampaignId FK to the parent [KujiCampaign].
 * @property name Box label, e.g. "籤盒 A".
 * @property totalTickets Total fixed ticket count. Immutable after campaign activation.
 * @property remainingTickets Current count of available tickets. Decremented atomically on draw.
 * @property status Current draw pool state.
 * @property soldOutAt Timestamp set when [remainingTickets] reaches 0.
 * @property displayOrder Rendering order within the campaign.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class TicketBox(
    val id: UUID,
    val kujiCampaignId: CampaignId,
    val name: String,
    val totalTickets: Int,
    val remainingTickets: Int,
    val status: TicketBoxStatus,
    val soldOutAt: Instant?,
    val displayOrder: Int,
    val createdAt: Instant,
    val updatedAt: Instant,
)
