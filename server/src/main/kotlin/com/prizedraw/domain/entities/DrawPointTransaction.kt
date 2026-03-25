package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * An immutable ledger entry for a player's draw-point balance.
 *
 * Records are INSERT-only (no UPDATE or DELETE). Each entry captures the signed
 * point change and the resulting balance, forming a full audit trail.
 *
 * @property id Surrogate primary key.
 * @property playerId FK to the [Player] whose balance changed.
 * @property type Classification of the point movement.
 * @property amount Signed point amount (positive = credit, negative = debit).
 * @property balanceAfter The player's draw-point balance after this transaction.
 * @property paymentOrderId FK to the originating [PaymentOrder] for purchase credits.
 * @property description Optional human-readable description.
 * @property createdAt Immutable creation timestamp.
 */
public data class DrawPointTransaction(
    val id: UUID,
    val playerId: PlayerId,
    val type: DrawPointTxType,
    val amount: Int,
    val balanceAfter: Int,
    val paymentOrderId: UUID?,
    val description: String?,
    val createdAt: Instant,
)
