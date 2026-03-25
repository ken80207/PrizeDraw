package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.WithdrawalStatus
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A player's request to convert revenue points to fiat currency via bank transfer (提領申請).
 *
 * Requires manual staff approval. Revenue points are reserved (debited) at submission time
 * via a WITHDRAWAL_DEBIT transaction. If the request is rejected, a compensating
 * ADMIN_ADJUSTMENT credit is issued.
 *
 * The [accountNumber] must be stored encrypted at rest using application-layer encryption
 * before persistence.
 *
 * @property id Surrogate primary key.
 * @property playerId FK to the requesting [Player].
 * @property pointsAmount Revenue points requested for withdrawal. Must be positive.
 * @property fiatAmount Equivalent fiat in the smallest currency unit. Snapshotted at request time.
 * @property currencyCode ISO 4217 currency code, e.g. `TWD`.
 * @property bankName Bank name.
 * @property bankCode Bank routing or branch code.
 * @property accountHolderName Account holder's legal name.
 * @property accountNumber Bank account number (stored encrypted at rest).
 * @property status Current withdrawal state.
 * @property reviewedByStaffId FK to the Staff member who approved or rejected. Null until reviewed.
 * @property reviewedAt When the review decision was made.
 * @property transferredAt When the bank transfer was executed.
 * @property rejectionReason Staff-provided reason for rejection.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class WithdrawalRequest(
    val id: UUID,
    val playerId: PlayerId,
    val pointsAmount: Int,
    val fiatAmount: Int,
    val currencyCode: String,
    val bankName: String,
    val bankCode: String,
    val accountHolderName: String,
    val accountNumber: String,
    val status: WithdrawalStatus,
    val reviewedByStaffId: UUID?,
    val reviewedAt: Instant?,
    val transferredAt: Instant?,
    val rejectionReason: String?,
    val createdAt: Instant,
    val updatedAt: Instant,
)
