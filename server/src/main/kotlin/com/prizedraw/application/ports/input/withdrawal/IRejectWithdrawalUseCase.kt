package com.prizedraw.application.ports.input.withdrawal

import com.prizedraw.contracts.dto.withdrawal.WithdrawalRequestDto
import java.util.UUID

/**
 * Input port for staff rejection of a withdrawal request.
 *
 * Revenue points are refunded via a compensating ADMIN_ADJUSTMENT credit.
 */
public interface IRejectWithdrawalUseCase {
    /**
     * Rejects the withdrawal request and refunds the revenue points.
     *
     * @param staffId      The staff member rejecting the request.
     * @param withdrawalId The withdrawal request identifier.
     * @param reason       Human-readable rejection reason.
     * @return The updated [WithdrawalRequestDto].
     */
    public suspend fun execute(
        staffId: UUID,
        withdrawalId: UUID,
        reason: String,
    ): WithdrawalRequestDto
}
