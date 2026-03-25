package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * How a player originally acquired a [PrizeInstance].
 */
public enum class PrizeAcquisitionMethod {
    /** Acquired by drawing a ticket from a [KujiCampaign]. */
    KUJI_DRAW,

    /** Acquired from an [UnlimitedCampaign] draw. */
    UNLIMITED_DRAW,

    /** Acquired by purchasing from another player's [TradeListing]. */
    TRADE_PURCHASE,

    /** Acquired via a completed player-to-player exchange. */
    EXCHANGE,
}

/**
 * A concrete prize owned by a player.
 *
 * Created when a ticket is drawn (kuji) or when an unlimited draw resolves.
 * Tracks the full lifecycle of a prize from acquisition through to final disposition
 * (shipped, sold, exchanged, recycled). The [state] field is the central state machine.
 *
 * Terminal states are [PrizeState.SOLD], [PrizeState.RECYCLED], and [PrizeState.DELIVERED].
 * Records in terminal states are soft-deleted ([deletedAt] is set) and removed from active
 * prize inventory queries but retained for history.
 *
 * @property id Surrogate primary key.
 * @property prizeDefinitionId FK to the [PrizeDefinition] template.
 * @property ownerId FK to the current owning [Player].
 * @property acquisitionMethod How the player originally received this prize.
 * @property sourceDrawTicketId FK to the [DrawTicket] that generated this prize. Non-null for KUJI_DRAW.
 * @property sourceTradeOrderId FK to the [TradeListing] that transferred this prize. Non-null for TRADE_PURCHASE.
 * @property sourceExchangeRequestId FK to the [ExchangeRequest] that transferred this prize. Non-null for EXCHANGE.
 * @property state Current lifecycle state.
 * @property acquiredAt When the player first received this prize.
 * @property deletedAt Soft-delete timestamp. Set when entering a terminal state.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class PrizeInstance(
    val id: PrizeInstanceId,
    val prizeDefinitionId: PrizeDefinitionId,
    val ownerId: PlayerId,
    val acquisitionMethod: PrizeAcquisitionMethod,
    val sourceDrawTicketId: UUID?,
    val sourceTradeOrderId: UUID?,
    val sourceExchangeRequestId: UUID?,
    val state: PrizeState,
    val acquiredAt: Instant,
    val deletedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    /** Returns true if this prize is in a terminal state. */
    public fun isTerminal(): Boolean =
        state == PrizeState.SOLD || state == PrizeState.RECYCLED || state == PrizeState.DELIVERED

    /** Returns true if this prize is actively available in the player's inventory. */
    public fun isInInventory(): Boolean = state == PrizeState.HOLDING && deletedAt == null
}
