package com.prizedraw.application.ports.input.exchange

import com.prizedraw.contracts.dto.exchange.ExchangeOfferDto
import com.prizedraw.contracts.dto.exchange.RespondExchangeRequest
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Input port for responding to an exchange request.
 *
 * Supports ACCEPT (atomic swap), REJECT (restore HOLDING), and COUNTER_PROPOSE
 * (create a child request with swapped roles).
 */
public interface IRespondExchangeRequestUseCase {
    /**
     * Processes a response to an existing [ExchangeRequest].
     *
     * @param responderId The player responding (must be the recipient).
     * @param requestId   The exchange request identifier.
     * @param response    The action and optional counter-offer items.
     * @return The updated [ExchangeOfferDto].
     */
    public suspend fun execute(
        responderId: PlayerId,
        requestId: UUID,
        response: RespondExchangeRequest,
    ): ExchangeOfferDto
}
