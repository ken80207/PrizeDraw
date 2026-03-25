package com.prizedraw.application.ports.input.trade

import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Input port for cancelling a LISTED trade listing.
 */
public interface ICancelTradeListingUseCase {
    /**
     * Cancels the listing [listingId] and restores the prize to HOLDING state.
     *
     * Validates that the requester is the seller and the listing is LISTED.
     *
     * @param sellerId The seller's player identifier (must own the listing).
     * @param listingId The listing to cancel.
     */
    public suspend fun execute(
        sellerId: PlayerId,
        listingId: UUID,
    )
}
