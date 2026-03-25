package com.prizedraw.application.ports.output

import com.prizedraw.contracts.enums.TradeOrderStatus
import com.prizedraw.domain.entities.TradeListing
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import java.util.UUID

/**
 * Output port for persisting and querying [TradeListing] (trade order) entities.
 */
public interface ITradeRepository {
    /**
     * Finds a [TradeListing] by its surrogate primary key.
     *
     * @param id The trade order identifier.
     * @return The matching [TradeListing], or null if not found.
     */
    public suspend fun findById(id: UUID): TradeListing?

    /**
     * Finds the currently active (LISTED) listing for a prize instance, if any.
     *
     * At most one LISTED order may exist per prize instance at a time.
     *
     * @param prizeInstanceId The prize being queried.
     * @return The active listing, or null if the prize is not currently listed.
     */
    public suspend fun findActiveListing(prizeInstanceId: PrizeInstanceId): TradeListing?

    /**
     * Returns all listings for the given seller, optionally filtered by status.
     *
     * @param sellerId The seller's player identifier.
     * @param status When non-null, restricts results to this status.
     * @return List of the seller's trade listings.
     */
    public suspend fun findBySeller(
        sellerId: PlayerId,
        status: TradeOrderStatus? = null,
    ): List<TradeListing>

    /**
     * Returns all active (LISTED) marketplace listings, ordered by listing time descending.
     *
     * @param offset Zero-based record offset for pagination.
     * @param limit Maximum number of records to return.
     * @return A page of active listings.
     */
    public suspend fun findActiveListings(
        offset: Int,
        limit: Int,
    ): List<TradeListing>

    /**
     * Persists a [TradeListing] entity (insert or update).
     *
     * @param listing The trade listing to persist.
     * @return The persisted listing.
     */
    public suspend fun save(listing: TradeListing): TradeListing
}
