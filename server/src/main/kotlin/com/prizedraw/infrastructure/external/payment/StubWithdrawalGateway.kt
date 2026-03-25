package com.prizedraw.infrastructure.external.payment

import com.prizedraw.application.ports.output.IWithdrawalGateway
import com.prizedraw.application.ports.output.TransferResult
import com.prizedraw.domain.entities.WithdrawalRequest
import org.slf4j.LoggerFactory

/**
 * Stub implementation of [IWithdrawalGateway] for local development and testing.
 *
 * Always returns a successful transfer result with a deterministic fake reference ID.
 * Replace with a real bank-transfer adapter before deploying to production.
 */
public class StubWithdrawalGateway : IWithdrawalGateway {
    private val log = LoggerFactory.getLogger(StubWithdrawalGateway::class.java)

    override suspend fun initiateTransfer(request: WithdrawalRequest): TransferResult {
        log.warn(
            "StubWithdrawalGateway.initiateTransfer called for request {} — not a real transfer",
            request.id,
        )
        return TransferResult(
            success = true,
            externalReferenceId = "stub-ref-${request.id}",
            failureReason = null,
        )
    }
}
