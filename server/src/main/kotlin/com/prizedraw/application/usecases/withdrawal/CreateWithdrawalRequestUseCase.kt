package com.prizedraw.application.usecases.withdrawal

import com.prizedraw.application.ports.input.withdrawal.ICreateWithdrawalRequestUseCase
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IWithdrawalRepository
import com.prizedraw.application.services.InsufficientBalanceException
import com.prizedraw.application.services.PointsLedgerService
import com.prizedraw.contracts.dto.withdrawal.CreateWithdrawalRequest
import com.prizedraw.contracts.dto.withdrawal.WithdrawalRequestDto
import com.prizedraw.contracts.enums.RevenuePointTxType
import com.prizedraw.contracts.enums.WithdrawalStatus
import com.prizedraw.domain.entities.WithdrawalRequest
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/** Points-to-TWD conversion rate (1 revenue point = 1 TWD cent). */
private const val POINTS_TO_FIAT_RATE = 1

/**
 * Creates a withdrawal request and immediately debits revenue points.
 *
 * Transaction steps:
 * 1. Validate pointsAmount > 0 and player balance >= pointsAmount.
 * 2. Debit revenue_points_balance via [PointsLedgerService].
 * 3. Insert [WithdrawalRequest](PENDING_REVIEW).
 */
public class CreateWithdrawalRequestUseCase(
    private val playerRepository: IPlayerRepository,
    private val withdrawalRepository: IWithdrawalRepository,
    private val pointsLedgerService: PointsLedgerService,
) : ICreateWithdrawalRequestUseCase {
    override suspend fun execute(
        playerId: PlayerId,
        request: CreateWithdrawalRequest,
    ): WithdrawalRequestDto {
        require(request.pointsAmount > 0) { "Withdrawal amount must be positive" }
        require(request.bankName.isNotBlank()) { "Bank name is required" }
        require(request.bankCode.isNotBlank()) { "Bank code is required" }
        require(request.accountHolderName.isNotBlank()) { "Account holder name is required" }
        require(request.accountNumber.isNotBlank()) { "Account number is required" }
        return newSuspendedTransaction {
            val player =
                playerRepository.findById(playerId)
                    ?: error("Player ${playerId.value} not found")
            if (player.revenuePointsBalance < request.pointsAmount) {
                throw InsufficientBalanceException(
                    "Insufficient revenue points: need ${request.pointsAmount}, " +
                        "have ${player.revenuePointsBalance}",
                )
            }
            val now = Clock.System.now()
            val withdrawalRequest =
                WithdrawalRequest(
                    id = UUID.randomUUID(),
                    playerId = playerId,
                    pointsAmount = request.pointsAmount,
                    fiatAmount = request.pointsAmount * POINTS_TO_FIAT_RATE,
                    currencyCode = "TWD",
                    bankName = request.bankName,
                    bankCode = request.bankCode,
                    accountHolderName = request.accountHolderName,
                    accountNumber = request.accountNumber,
                    status = WithdrawalStatus.PENDING_REVIEW,
                    reviewedByStaffId = null,
                    reviewedAt = null,
                    transferredAt = null,
                    rejectionReason = null,
                    createdAt = now,
                    updatedAt = now,
                )
            val saved = withdrawalRepository.save(withdrawalRequest)
            pointsLedgerService.debitRevenuePoints(
                playerId = playerId,
                amount = request.pointsAmount,
                txType = RevenuePointTxType.WITHDRAWAL_DEBIT,
                referenceId = saved.id,
                description = "Withdrawal request ${saved.id}",
            )
            saved.toDto()
        }
    }
}
