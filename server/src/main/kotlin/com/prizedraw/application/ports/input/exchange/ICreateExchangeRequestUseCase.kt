package com.prizedraw.application.ports.input.exchange

import com.prizedraw.contracts.dto.exchange.CreateExchangeRequest
import com.prizedraw.contracts.dto.exchange.ExchangeOfferDto
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for creating a prize exchange request.
 *
 * Subject to the `exchange_feature` feature flag (FR-079).
 */
public interface ICreateExchangeRequestUseCase {
    /**
     * Creates a new exchange request, transitioning the initiator's offered prizes to EXCHANGING.
     *
     * @param initiatorId The player initiating the exchange.
     * @param request     Offered and requested prize instance IDs plus optional message.
     * @return The persisted [ExchangeOfferDto].
     */
    public suspend fun execute(
        initiatorId: PlayerId,
        request: CreateExchangeRequest,
    ): ExchangeOfferDto
}
