package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.ExchangeItemSide
import com.prizedraw.contracts.enums.ExchangeRequestStatus
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A multi-to-multi prize swap proposal between two players (交換請求).
 *
 * No points are involved in an exchange. Either party can counter-propose
 * (changing the offered prize sets) before acceptance. Subject to the
 * global `exchange_feature` feature flag.
 *
 * When a request is created the initiator's offered prizes transition to
 * [com.prizedraw.contracts.enums.PrizeState.EXCHANGING] atomically.
 *
 * @property id Surrogate primary key.
 * @property initiatorId FK to the [Player] who originated the request.
 * @property recipientId FK to the [Player] who received the request.
 * @property parentRequestId FK to the [ExchangeRequest] this counter-proposes. Null for root requests.
 * @property status Current exchange state.
 * @property message Optional note from the initiator to the recipient.
 * @property respondedAt When the recipient accepted, rejected, or counter-proposed.
 * @property completedAt When the swap was executed.
 * @property cancelledAt When the request was cancelled.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class ExchangeRequest(
    val id: UUID,
    val initiatorId: PlayerId,
    val recipientId: PlayerId,
    val parentRequestId: UUID?,
    val status: ExchangeRequestStatus,
    val message: String?,
    val respondedAt: Instant?,
    val completedAt: Instant?,
    val cancelledAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    /** Returns true if this exchange is in a terminal state. */
    public fun isTerminal(): Boolean =
        status == ExchangeRequestStatus.COMPLETED ||
            status == ExchangeRequestStatus.REJECTED ||
            status == ExchangeRequestStatus.CANCELLED
}

/**
 * Junction record that associates a [PrizeInstance] with an [ExchangeRequest].
 *
 * The [side] column identifies whether the item belongs to the initiator or recipient.
 * Each side must offer at least one prize; a prize instance may only appear once per request.
 *
 * @property id Surrogate primary key.
 * @property exchangeRequestId FK to the parent [ExchangeRequest].
 * @property prizeInstanceId FK to the [PrizeInstance] being offered.
 * @property side Which party is offering this prize.
 * @property createdAt Creation timestamp.
 */
public data class ExchangeRequestItem(
    val id: UUID,
    val exchangeRequestId: UUID,
    val prizeInstanceId: PrizeInstanceId,
    val side: ExchangeItemSide,
    val createdAt: Instant,
)
