package com.prizedraw.application.ports.input.trade

import com.prizedraw.contracts.dto.trade.CreateListingRequest
import com.prizedraw.contracts.dto.trade.TradeListingDto
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for creating a new marketplace trade listing.
 */
public interface ICreateTradeListingUseCase {
    /**
     * Creates a trade listing for a HOLDING prize.
     *
     * Validates that the prize is owned by [playerId] and in HOLDING state.
     * In a single DB transaction: creates the listing, transitions prize to TRADING.
     *
     * @param playerId The seller's player identifier.
     * @param request Listing details (prizeInstanceId, listPrice).
     * @return The persisted [TradeListingDto].
     */
    public suspend fun execute(
        playerId: PlayerId,
        request: CreateListingRequest,
    ): TradeListingDto
}
