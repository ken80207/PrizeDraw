package com.prizedraw.domain.entities

import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Status of a [DrawTicket] slot.
 */
public enum class DrawTicketStatus {
    /** The ticket has not yet been drawn. */
    AVAILABLE,

    /** The ticket has been drawn by a player. Terminal state. */
    DRAWN,
}

/**
 * One physical ticket slot inside a [TicketBox].
 *
 * Every ticket has a fixed [PrizeDefinition] assigned at campaign creation time.
 * The ticket layout is immutable once the parent campaign is `ACTIVE`. A ticket
 * may be drawn by a player (changing status to [DrawTicketStatus.DRAWN]) exactly once.
 *
 * When drawn, [drawnByPlayerId], [drawnAt], and [prizeInstanceId] are all set
 * atomically within the same database transaction.
 *
 * @property id Surrogate primary key.
 * @property ticketBoxId FK to the parent [TicketBox].
 * @property prizeDefinitionId FK to the [PrizeDefinition] behind this slot.
 * @property position 1-based slot number shown on the ticket board. Unique within a box.
 * @property status Current draw state.
 * @property drawnByPlayerId FK to the [Player] who drew this ticket. Null until drawn.
 * @property drawnAt Timestamp of the draw event. Null until drawn.
 * @property prizeInstanceId FK to the [PrizeInstance] created by this draw. Null until drawn.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class DrawTicket(
    val id: UUID,
    val ticketBoxId: UUID,
    val prizeDefinitionId: PrizeDefinitionId,
    val position: Int,
    val status: DrawTicketStatus,
    val drawnByPlayerId: PlayerId?,
    val drawnAt: Instant?,
    val prizeInstanceId: PrizeInstanceId?,
    val createdAt: Instant,
    val updatedAt: Instant,
)
