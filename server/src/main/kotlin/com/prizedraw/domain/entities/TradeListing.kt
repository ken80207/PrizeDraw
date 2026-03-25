package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.TradeOrderStatus
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A player-to-player prize sale listing in the marketplace (交易訂單).
 *
 * The seller lists the prize at a draw-point price; a buyer purchases it. A platform fee
 * (configurable percentage captured in [feeRateBps] at listing time) is deducted from the
 * seller's revenue points credit.
 *
 * The purchase must be atomic: debit buyer's draw points, credit seller's revenue points,
 * update [PrizeInstance] ownership and state, and update this record's [status] — all
 * in one database transaction.
 *
 * @property id Surrogate primary key; also used as the merchant order reference.
 * @property sellerId FK to the selling [Player].
 * @property buyerId FK to the buying [Player]. Null until a purchase is made.
 * @property prizeInstanceId FK to the [PrizeInstance] being sold.
 * @property listPrice Asking price in draw points. Must be positive.
 * @property feeRateBps Platform fee rate at listing time in basis points (e.g. 500 = 5.00%).
 * @property feeAmount Computed fee in points. Set at purchase time. Null until purchased.
 * @property sellerProceeds `listPrice - feeAmount`. Credited as revenue points. Null until purchased.
 * @property status Current trade order state.
 * @property listedAt When the item was listed.
 * @property completedAt When the sale completed. Null until completed.
 * @property cancelledAt When the listing was cancelled. Null unless cancelled.
 * @property deletedAt Soft-delete timestamp.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class TradeListing(
    val id: UUID,
    val sellerId: PlayerId,
    val buyerId: PlayerId?,
    val prizeInstanceId: PrizeInstanceId,
    val listPrice: Int,
    val feeRateBps: Int,
    val feeAmount: Int?,
    val sellerProceeds: Int?,
    val status: TradeOrderStatus,
    val listedAt: Instant,
    val completedAt: Instant?,
    val cancelledAt: Instant?,
    val deletedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)
