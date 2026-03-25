package com.prizedraw.application.ports.input.trade

import com.prizedraw.contracts.dto.trade.TradeListingDto
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Input port for purchasing a LISTED trade listing.
 *
 * The purchase must be fully atomic: buyer draw-point debit, seller revenue-point credit,
 * prize ownership transfer, fee calculation, and ledger entries all in one transaction.
 */
public interface IPurchaseTradeListingUseCase {
    /**
     * Executes the full atomic purchase of listing [listingId] by [buyerId].
     *
     * @param buyerId The purchasing player's identifier.
     * @param listingId The trade listing to purchase.
     * @return The completed [TradeListingDto].
     */
    public suspend fun execute(
        buyerId: PlayerId,
        listingId: UUID,
    ): TradeListingDto
}
