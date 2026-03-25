package com.prizedraw.application.ports.input.withdrawal

import com.prizedraw.contracts.dto.withdrawal.CreateWithdrawalRequest
import com.prizedraw.contracts.dto.withdrawal.WithdrawalRequestDto
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for submitting a revenue-point withdrawal request.
 *
 * Revenue points are debited immediately at submission (not at approval).
 */
public interface ICreateWithdrawalRequestUseCase {
    /**
     * Creates a withdrawal request and immediately debits the revenue points.
     *
     * @param playerId The requesting player.
     * @param request  Bank account details and amount.
     * @return The created [WithdrawalRequestDto].
     */
    public suspend fun execute(
        playerId: PlayerId,
        request: CreateWithdrawalRequest,
    ): WithdrawalRequestDto
}
