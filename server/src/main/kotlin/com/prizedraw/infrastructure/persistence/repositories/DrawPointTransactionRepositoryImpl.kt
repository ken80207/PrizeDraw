package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.domain.entities.DrawPointTransaction
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.schema.tables.DrawPointTransactionsTable
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
 * Exposed-backed implementation of [IDrawPointTransactionRepository].
 */
public class DrawPointTransactionRepositoryImpl : IDrawPointTransactionRepository {
    override fun record(transaction: DrawPointTransaction) {
        DrawPointTransactionsTable.insert {
            it[id] = transaction.id
            it[playerId] = transaction.playerId.value
            it[type] = transaction.type
            it[amount] = transaction.amount
            it[balanceAfter] = transaction.balanceAfter
            it[paymentOrderId] = transaction.paymentOrderId
            it[description] = transaction.description
            it[createdAt] = transaction.createdAt.toOffsetDateTime()
        }
    }

    override suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<DrawPointTransaction> =
        newSuspendedTransaction {
            DrawPointTransactionsTable
                .selectAll()
                .where { DrawPointTransactionsTable.playerId eq playerId.value }
                .orderBy(DrawPointTransactionsTable.createdAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toDrawPointTransaction() }
        }

    private fun ResultRow.toDrawPointTransaction(): DrawPointTransaction =
        DrawPointTransaction(
            id = this[DrawPointTransactionsTable.id],
            playerId = PlayerId(this[DrawPointTransactionsTable.playerId]),
            type = this[DrawPointTransactionsTable.type],
            amount = this[DrawPointTransactionsTable.amount],
            balanceAfter = this[DrawPointTransactionsTable.balanceAfter],
            paymentOrderId = this[DrawPointTransactionsTable.paymentOrderId],
            description = this[DrawPointTransactionsTable.description],
            createdAt = this[DrawPointTransactionsTable.createdAt].toInstant().toKotlinInstant(),
        )

    private fun Instant.toOffsetDateTime(): OffsetDateTime = OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)
}
