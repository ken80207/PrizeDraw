package com.prizedraw.domain.entities

import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * An immutable record of a prize being sold back to the platform (回收紀錄).
 *
 * The [buybackPrice] is captured at submission time so retroactive price changes do not
 * affect already-submitted records. The buyback transaction (credit revenue points +
 * set [PrizeInstance] to RECYCLED + insert this record) is a single atomic DB transaction.
 *
 * Records are INSERT-only; no updates or deletes are permitted.
 *
 * @property id Surrogate primary key.
 * @property playerId FK to the [Player] who initiated the buyback.
 * @property prizeInstanceId FK to the [PrizeInstance] being recycled. Unique.
 * @property prizeDefinitionId FK to the [PrizeDefinition] snapshotted for analytics.
 * @property buybackPrice Revenue points credited; snapshotted at submission time.
 * @property processedAt When the points were credited and the prize removed.
 * @property createdAt Creation timestamp.
 */
public data class BuybackRecord(
    val id: UUID,
    val playerId: PlayerId,
    val prizeInstanceId: PrizeInstanceId,
    val prizeDefinitionId: PrizeDefinitionId,
    val buybackPrice: Int,
    val processedAt: Instant,
    val createdAt: Instant,
)
