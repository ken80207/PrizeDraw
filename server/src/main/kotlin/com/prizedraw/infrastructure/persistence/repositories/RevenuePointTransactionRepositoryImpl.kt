package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IRevenuePointTransactionRepository
import com.prizedraw.domain.entities.RevenuePointTransaction
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.infrastructure.persistence.tables.RevenuePointTransactionsTable
import kotlinx.datetime.Instant
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * Exposed-backed implementation of [IRevenuePointTransactionRepository].
 */
public class RevenuePointTransactionRepositoryImpl : IRevenuePointTransactionRepository {
    override fun record(transaction: RevenuePointTransaction) {
        RevenuePointTransactionsTable.insert {
            it[id] = transaction.id
            it[playerId] = transaction.playerId.value
            it[type] = transaction.type
            it[amount] = transaction.amount
            it[balanceAfter] = transaction.balanceAfter
            it[tradeOrderId] = transaction.tradeOrderId
            it[description] = transaction.description
            it[createdAt] = transaction.createdAt.toOffsetDateTime()
        }
    }

    override suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<RevenuePointTransaction> =
        newSuspendedTransaction {
            RevenuePointTransactionsTable
                .selectAll()
                .where { RevenuePointTransactionsTable.playerId eq playerId.value }
                .orderBy(RevenuePointTransactionsTable.createdAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toRevenuePointTransaction() }
        }

    private fun ResultRow.toRevenuePointTransaction(): RevenuePointTransaction =
        RevenuePointTransaction(
            id = this[RevenuePointTransactionsTable.id],
            playerId = PlayerId(this[RevenuePointTransactionsTable.playerId]),
            type = this[RevenuePointTransactionsTable.type],
            amount = this[RevenuePointTransactionsTable.amount],
            balanceAfter = this[RevenuePointTransactionsTable.balanceAfter],
            tradeOrderId = this[RevenuePointTransactionsTable.tradeOrderId],
            description = this[RevenuePointTransactionsTable.description],
            createdAt = this[RevenuePointTransactionsTable.createdAt].toInstant().toKotlinInstant(),
        )

    private fun Instant.toOffsetDateTime(): OffsetDateTime = OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)
}
