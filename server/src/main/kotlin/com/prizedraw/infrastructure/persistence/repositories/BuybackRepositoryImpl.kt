package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IBuybackRepository
import com.prizedraw.domain.entities.BuybackRecord
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import com.prizedraw.infrastructure.persistence.tables.BuybackRecordsTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

public class BuybackRepositoryImpl : IBuybackRepository {
    override suspend fun findById(id: UUID): BuybackRecord? =
        newSuspendedTransaction {
            BuybackRecordsTable
                .selectAll()
                .where { BuybackRecordsTable.id eq id }
                .singleOrNull()
                ?.toBuybackRecord()
        }

    override suspend fun findByPrizeInstance(prizeInstanceId: PrizeInstanceId): BuybackRecord? =
        newSuspendedTransaction {
            BuybackRecordsTable
                .selectAll()
                .where { BuybackRecordsTable.prizeInstanceId eq prizeInstanceId.value }
                .singleOrNull()
                ?.toBuybackRecord()
        }

    override suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<BuybackRecord> =
        newSuspendedTransaction {
            BuybackRecordsTable
                .selectAll()
                .where { BuybackRecordsTable.playerId eq playerId.value }
                .orderBy(BuybackRecordsTable.processedAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toBuybackRecord() }
        }

    override suspend fun findByDefinition(definitionId: PrizeDefinitionId): List<BuybackRecord> =
        newSuspendedTransaction {
            BuybackRecordsTable
                .selectAll()
                .where { BuybackRecordsTable.prizeDefinitionId eq definitionId.value }
                .map { it.toBuybackRecord() }
        }

    override suspend fun save(record: BuybackRecord): BuybackRecord =
        newSuspendedTransaction {
            BuybackRecordsTable.insert {
                it[id] = record.id
                it[playerId] = record.playerId.value
                it[prizeInstanceId] = record.prizeInstanceId.value
                it[prizeDefinitionId] = record.prizeDefinitionId.value
                it[buybackPrice] = record.buybackPrice
                it[processedAt] = OffsetDateTime.ofInstant(record.processedAt.toJavaInstant(), ZoneOffset.UTC)
                it[createdAt] = OffsetDateTime.ofInstant(record.createdAt.toJavaInstant(), ZoneOffset.UTC)
            }
            BuybackRecordsTable
                .selectAll()
                .where { BuybackRecordsTable.id eq record.id }
                .single()
                .toBuybackRecord()
        }

    private fun ResultRow.toBuybackRecord(): BuybackRecord =
        BuybackRecord(
            id = this[BuybackRecordsTable.id],
            playerId = PlayerId(this[BuybackRecordsTable.playerId]),
            prizeInstanceId = PrizeInstanceId(this[BuybackRecordsTable.prizeInstanceId]),
            prizeDefinitionId = PrizeDefinitionId(this[BuybackRecordsTable.prizeDefinitionId]),
            buybackPrice = this[BuybackRecordsTable.buybackPrice],
            processedAt = this[BuybackRecordsTable.processedAt].toInstant().toKotlinInstant(),
            createdAt = this[BuybackRecordsTable.createdAt].toInstant().toKotlinInstant(),
        )
}
