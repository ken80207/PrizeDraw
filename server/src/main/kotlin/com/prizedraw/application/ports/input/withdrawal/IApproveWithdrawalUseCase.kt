package com.prizedraw.application.ports.input.withdrawal

import com.prizedraw.contracts.dto.withdrawal.WithdrawalRequestDto
import java.util.UUID

/**
 * Input port for staff approval of a withdrawal request.
 *
 * On success, initiates the bank transfer via [com.prizedraw.application.ports.output.IWithdrawalGateway].
 */
public interface IApproveWithdrawalUseCase {
    /**
     * Approves the withdrawal request, initiates bank transfer, and sets status to TRANSFERRED.
     *
     * @param staffId      The staff member approving the request.
     * @param withdrawalId The withdrawal request identifier.
     * @return The updated [WithdrawalRequestDto].
     */
    public suspend fun execute(
        staffId: UUID,
        withdrawalId: UUID,
    ): WithdrawalRequestDto
}
