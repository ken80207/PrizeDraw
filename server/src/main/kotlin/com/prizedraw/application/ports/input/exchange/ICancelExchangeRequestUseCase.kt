package com.prizedraw.application.ports.input.exchange

import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Input port for cancelling a pending exchange request.
 *
 * Only the initiator may cancel. All EXCHANGING prizes are restored to HOLDING.
 */
public interface ICancelExchangeRequestUseCase {
    /**
     * Cancels the exchange request and restores all locked prizes to HOLDING.
     *
     * @param cancellerId The player attempting to cancel (must be the initiator).
     * @param requestId   The exchange request identifier.
     */
    public suspend fun execute(
        cancellerId: PlayerId,
        requestId: UUID,
    )
}
