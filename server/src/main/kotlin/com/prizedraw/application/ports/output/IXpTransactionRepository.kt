package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.XpTransaction
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Output port for persisting and querying [XpTransaction] records.
 *
 * Implementations live in the infrastructure layer. All operations are `suspend` to
 * integrate with Ktor's coroutine execution model.
 */
public interface IXpTransactionRepository {
    /**
     * Persists a new XP transaction record.
     *
     * This must be called **inside** the same database transaction as the corresponding
     * player XP update so the ledger and balance remain consistent.
     *
     * @param transaction The XP transaction to persist.
     */
    public suspend fun save(transaction: XpTransaction)

    /**
     * Returns a paginated list of XP transactions for a given player, ordered by
     * [XpTransaction.createdAt] descending (most recent first).
     *
     * @param playerId The player whose history to fetch.
     * @param offset Zero-based record offset for pagination.
     * @param limit Maximum number of records to return.
     * @return Ordered list of XP transactions.
     */
    public suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<XpTransaction>
}
