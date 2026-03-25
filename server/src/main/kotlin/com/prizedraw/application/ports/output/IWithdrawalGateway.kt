package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.WithdrawalRequest

/**
 * Result of initiating a bank transfer for a withdrawal request.
 *
 * @property success True if the transfer was accepted by the bank or payment processor.
 * @property externalReferenceId Bank or processor reference number for the transfer.
 * @property failureReason Human-readable reason when [success] is false.
 */
public data class TransferResult(
    val success: Boolean,
    val externalReferenceId: String?,
    val failureReason: String?,
)

/**
 * Output port for initiating fiat bank transfers for revenue point withdrawals (提領匯款閘道).
 *
 * Implementations connect to the bank's API or a financial intermediary service. This
 * operation is called after a withdrawal request transitions to APPROVED status.
 */
public interface IWithdrawalGateway {
    /**
     * Initiates a bank transfer for the given approved [WithdrawalRequest].
     *
     * The implementation must use the encrypted bank account details from [request] to
     * execute the transfer. The caller is responsible for persisting the
     * [TransferResult.externalReferenceId] and updating the request status to TRANSFERRED
     * on success.
     *
     * @param request The approved withdrawal request to transfer funds for.
     * @return The transfer result including an external reference ID on success.
     */
    public suspend fun initiateTransfer(request: WithdrawalRequest): TransferResult
}
