package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IXpTransactionRepository
import com.prizedraw.domain.entities.XpSourceType
import com.prizedraw.domain.entities.XpTransaction
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.schema.tables.XpTransactionsTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * Exposed-backed implementation of [IXpTransactionRepository].
 *
 * All operations use [newSuspendedTransaction] for coroutine-safe execution on
 * Dispatchers.IO. The `save` method is designed to be called inside an outer
 * business transaction (e.g. draw or trade) so the XP ledger stays atomic with
 * the player XP update.
 */
public class XpTransactionRepositoryImpl : IXpTransactionRepository {
    override suspend fun save(transaction: XpTransaction): Unit =
        newSuspendedTransaction {
            XpTransactionsTable.insert {
                it[id] = transaction.id
                it[playerId] = transaction.playerId
                it[amount] = transaction.amount
                it[sourceType] = transaction.sourceType.name
                it[sourceId] = transaction.sourceId
                it[description] = transaction.description
                it[createdAt] = transaction.createdAt.toJavaInstant().toOffsetDateTime()
            }
        }

    override suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<XpTransaction> =
        newSuspendedTransaction {
            XpTransactionsTable
                .selectAll()
                .where { XpTransactionsTable.playerId eq playerId.value }
                .orderBy(XpTransactionsTable.createdAt, SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { row ->
                    XpTransaction(
                        id = row[XpTransactionsTable.id],
                        playerId = row[XpTransactionsTable.playerId],
                        amount = row[XpTransactionsTable.amount],
                        sourceType = XpSourceType.valueOf(row[XpTransactionsTable.sourceType]),
                        sourceId = row[XpTransactionsTable.sourceId],
                        description = row[XpTransactionsTable.description],
                        createdAt = row[XpTransactionsTable.createdAt].toInstant().toKotlinInstant(),
                    )
                }
        }

    private fun java.time.Instant.toOffsetDateTime(): OffsetDateTime = OffsetDateTime.ofInstant(this, ZoneOffset.UTC)
}
