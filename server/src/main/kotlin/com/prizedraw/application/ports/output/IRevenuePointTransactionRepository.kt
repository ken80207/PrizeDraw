package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.RevenuePointTransaction
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Output port for the revenue-point transaction ledger.
 *
 * Operations are append-only: [record] inserts a new row, [findByPlayer] queries history.
 * Must be called within the same database transaction as the balance mutation.
 */
public interface IRevenuePointTransactionRepository {
    /**
     * Inserts a new [RevenuePointTransaction] ledger entry.
     *
     * Must be called within the same database transaction as the balance mutation
     * on the [com.prizedraw.domain.entities.Player] entity.
     *
     * @param transaction The transaction to record.
     */
    public fun record(transaction: RevenuePointTransaction)

    /**
     * Returns paginated revenue-point transaction history for a player, ordered by
     * creation time descending.
     *
     * @param playerId The player's identifier.
     * @param offset Zero-based record offset.
     * @param limit Maximum records to return.
     * @return A page of revenue-point transactions.
     */
    public suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<RevenuePointTransaction>
}
