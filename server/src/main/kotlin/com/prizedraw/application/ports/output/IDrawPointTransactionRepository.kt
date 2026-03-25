package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.DrawPointTransaction
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Output port for the draw-point transaction ledger.
 *
 * Operations are append-only: [record] inserts a new row, [findByPlayer] queries history.
 */
public interface IDrawPointTransactionRepository {
    /**
     * Inserts a new [DrawPointTransaction] ledger entry.
     *
     * Must be called within the same database transaction as the balance mutation.
     *
     * @param transaction The transaction to record.
     */
    public fun record(transaction: DrawPointTransaction)

    /**
     * Returns paginated draw-point transaction history for a player, ordered by creation
     * time descending.
     *
     * @param playerId The player's identifier.
     * @param offset Zero-based record offset.
     * @param limit Maximum records to return.
     * @return A page of draw-point transactions.
     */
    public suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<DrawPointTransaction>
}
