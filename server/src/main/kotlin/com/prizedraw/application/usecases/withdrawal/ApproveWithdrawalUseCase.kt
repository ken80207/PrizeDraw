package com.prizedraw.application.usecases.withdrawal

import com.prizedraw.application.ports.input.withdrawal.IApproveWithdrawalUseCase
import com.prizedraw.application.ports.output.IWithdrawalGateway
import com.prizedraw.application.ports.output.IWithdrawalRepository
import com.prizedraw.contracts.dto.withdrawal.WithdrawalRequestDto
import com.prizedraw.contracts.enums.WithdrawalStatus
import kotlinx.datetime.Clock
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/**
 * Approves a withdrawal request and initiates the bank transfer.
 *
 * Steps:
 * 1. Validate request exists and is PENDING_REVIEW.
 * 2. Set status to APPROVED with reviewer info.
 * 3. Call [IWithdrawalGateway.initiateTransfer].
 * 4. On success: set status to TRANSFERRED with transferredAt timestamp.
 */
public class ApproveWithdrawalUseCase(
    private val withdrawalRepository: IWithdrawalRepository,
    private val withdrawalGateway: IWithdrawalGateway,
) : IApproveWithdrawalUseCase {
    override suspend fun execute(
        staffId: UUID,
        withdrawalId: UUID,
    ): WithdrawalRequestDto {
        val request =
            withdrawalRepository.findById(withdrawalId)
                ?: throw WithdrawalNotFoundException("Withdrawal request $withdrawalId not found")
        if (request.status != WithdrawalStatus.PENDING_REVIEW) {
            throw WithdrawalStateException(
                "Cannot approve request in state: ${request.status}",
            )
        }
        val now = Clock.System.now()
        val approved =
            request.copy(
                status = WithdrawalStatus.APPROVED,
                reviewedByStaffId = staffId,
                reviewedAt = now,
                updatedAt = now,
            )
        val savedApproved = withdrawalRepository.save(approved)
        val transferResult = withdrawalGateway.initiateTransfer(savedApproved)
        if (!transferResult.success) {
            throw TransferFailedException(
                "Bank transfer failed: ${transferResult.failureReason}",
            )
        }
        val transferred =
            savedApproved.copy(
                status = WithdrawalStatus.TRANSFERRED,
                transferredAt = Clock.System.now(),
                updatedAt = Clock.System.now(),
            )
        return newSuspendedTransaction {
            withdrawalRepository.save(transferred).toDto()
        }
    }
}
