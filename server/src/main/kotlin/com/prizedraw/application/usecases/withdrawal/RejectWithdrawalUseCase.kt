package com.prizedraw.application.usecases.withdrawal

import com.prizedraw.application.ports.input.withdrawal.IRejectWithdrawalUseCase
import com.prizedraw.application.ports.output.IWithdrawalRepository
import com.prizedraw.application.services.PointsLedgerService
import com.prizedraw.contracts.dto.withdrawal.WithdrawalRequestDto
import com.prizedraw.contracts.enums.RevenuePointTxType
import com.prizedraw.contracts.enums.WithdrawalStatus
import kotlinx.datetime.Clock
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/**
 * Rejects a withdrawal request and refunds the debited revenue points.
 *
 * Steps:
 * 1. Validate request exists and is PENDING_REVIEW.
 * 2. In a transaction: set status to REJECTED, credit revenue points back via [PointsLedgerService].
 */
public class RejectWithdrawalUseCase(
    private val withdrawalRepository: IWithdrawalRepository,
    private val pointsLedgerService: PointsLedgerService,
) : IRejectWithdrawalUseCase {
    override suspend fun execute(
        staffId: UUID,
        withdrawalId: UUID,
        reason: String,
    ): WithdrawalRequestDto {
        require(reason.isNotBlank()) { "Rejection reason is required" }
        val request =
            withdrawalRepository.findById(withdrawalId)
                ?: throw WithdrawalNotFoundException("Withdrawal request $withdrawalId not found")
        if (request.status != WithdrawalStatus.PENDING_REVIEW) {
            throw WithdrawalStateException(
                "Cannot reject request in state: ${request.status}",
            )
        }
        val now = Clock.System.now()
        return newSuspendedTransaction {
            val rejected =
                request.copy(
                    status = WithdrawalStatus.REJECTED,
                    reviewedByStaffId = staffId,
                    reviewedAt = now,
                    rejectionReason = reason,
                    updatedAt = now,
                )
            val saved = withdrawalRepository.save(rejected)
            pointsLedgerService.creditRevenuePoints(
                playerId = request.playerId,
                amount = request.pointsAmount,
                txType = RevenuePointTxType.ADMIN_ADJUSTMENT,
                referenceId = withdrawalId,
                description = "Withdrawal rejection refund: $withdrawalId",
            )
            saved.toDto()
        }
    }
}
