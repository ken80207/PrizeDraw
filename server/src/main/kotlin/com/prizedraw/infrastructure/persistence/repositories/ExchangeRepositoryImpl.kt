package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IExchangeRepository
import com.prizedraw.contracts.enums.ExchangeItemSide
import com.prizedraw.contracts.enums.ExchangeRequestStatus
import com.prizedraw.domain.entities.ExchangeRequest
import com.prizedraw.domain.entities.ExchangeRequestItem
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import com.prizedraw.infrastructure.persistence.tables.ExchangeRequestItemsTable
import com.prizedraw.infrastructure.persistence.tables.ExchangeRequestsTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.batchInsert
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.or
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

public class ExchangeRepositoryImpl : IExchangeRepository {
    override suspend fun findById(id: UUID): ExchangeRequest? =
        newSuspendedTransaction {
            ExchangeRequestsTable
                .selectAll()
                .where { ExchangeRequestsTable.id eq id }
                .singleOrNull()
                ?.toExchangeRequest()
        }

    override suspend fun findByPlayer(
        playerId: PlayerId,
        status: ExchangeRequestStatus?,
    ): List<ExchangeRequest> =
        newSuspendedTransaction {
            ExchangeRequestsTable
                .selectAll()
                .where {
                    val playerCondition =
                        (ExchangeRequestsTable.initiatorId eq playerId.value) or
                            (ExchangeRequestsTable.recipientId eq playerId.value)
                    if (status != null) {
                        playerCondition and (ExchangeRequestsTable.status eq status)
                    } else {
                        playerCondition
                    }
                }.map { it.toExchangeRequest() }
        }

    override suspend fun findActiveRequests(
        offset: Int,
        limit: Int,
    ): List<ExchangeRequest> =
        newSuspendedTransaction {
            ExchangeRequestsTable
                .selectAll()
                .where {
                    (ExchangeRequestsTable.status eq ExchangeRequestStatus.PENDING) or
                        (ExchangeRequestsTable.status eq ExchangeRequestStatus.COUNTER_PROPOSED)
                }.orderBy(ExchangeRequestsTable.createdAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toExchangeRequest() }
        }

    override suspend fun save(request: ExchangeRequest): ExchangeRequest =
        newSuspendedTransaction {
            val existing =
                ExchangeRequestsTable
                    .selectAll()
                    .where { ExchangeRequestsTable.id eq request.id }
                    .singleOrNull()

            if (existing == null) {
                ExchangeRequestsTable.insert {
                    it[id] = request.id
                    it[initiatorId] = request.initiatorId.value
                    it[recipientId] = request.recipientId.value
                    it[parentRequestId] = request.parentRequestId
                    it[status] = request.status
                    it[message] = request.message
                    it[respondedAt] = request.respondedAt?.toOffsetDateTime()
                    it[completedAt] = request.completedAt?.toOffsetDateTime()
                    it[cancelledAt] = request.cancelledAt?.toOffsetDateTime()
                    it[createdAt] = request.createdAt.toOffsetDateTime()
                    it[updatedAt] = request.updatedAt.toOffsetDateTime()
                }
            } else {
                ExchangeRequestsTable.update({ ExchangeRequestsTable.id eq request.id }) {
                    it[status] = request.status
                    it[respondedAt] = request.respondedAt?.toOffsetDateTime()
                    it[completedAt] = request.completedAt?.toOffsetDateTime()
                    it[cancelledAt] = request.cancelledAt?.toOffsetDateTime()
                    it[updatedAt] = request.updatedAt.toOffsetDateTime()
                }
            }

            ExchangeRequestsTable
                .selectAll()
                .where { ExchangeRequestsTable.id eq request.id }
                .single()
                .toExchangeRequest()
        }

    override suspend fun findItemsByRequest(requestId: UUID): List<ExchangeRequestItem> =
        newSuspendedTransaction {
            ExchangeRequestItemsTable
                .selectAll()
                .where { ExchangeRequestItemsTable.exchangeRequestId eq requestId }
                .map { it.toExchangeRequestItem() }
        }

    override suspend fun saveItems(items: List<ExchangeRequestItem>): List<ExchangeRequestItem> =
        newSuspendedTransaction {
            ExchangeRequestItemsTable.batchInsert(items) { item ->
                this[ExchangeRequestItemsTable.id] = item.id
                this[ExchangeRequestItemsTable.exchangeRequestId] = item.exchangeRequestId
                this[ExchangeRequestItemsTable.prizeInstanceId] = item.prizeInstanceId.value
                this[ExchangeRequestItemsTable.side] = item.side
                this[ExchangeRequestItemsTable.createdAt] = item.createdAt.toOffsetDateTime()
            }
            items
        }

    private fun ResultRow.toExchangeRequest(): ExchangeRequest =
        ExchangeRequest(
            id = this[ExchangeRequestsTable.id],
            initiatorId = PlayerId(this[ExchangeRequestsTable.initiatorId]),
            recipientId = PlayerId(this[ExchangeRequestsTable.recipientId]),
            parentRequestId = this[ExchangeRequestsTable.parentRequestId],
            status = this[ExchangeRequestsTable.status],
            message = this[ExchangeRequestsTable.message],
            respondedAt = this[ExchangeRequestsTable.respondedAt]?.toInstant()?.toKotlinInstant(),
            completedAt = this[ExchangeRequestsTable.completedAt]?.toInstant()?.toKotlinInstant(),
            cancelledAt = this[ExchangeRequestsTable.cancelledAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[ExchangeRequestsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[ExchangeRequestsTable.updatedAt].toInstant().toKotlinInstant(),
        )

    private fun ResultRow.toExchangeRequestItem(): ExchangeRequestItem =
        ExchangeRequestItem(
            id = this[ExchangeRequestItemsTable.id],
            exchangeRequestId = this[ExchangeRequestItemsTable.exchangeRequestId],
            prizeInstanceId = PrizeInstanceId(this[ExchangeRequestItemsTable.prizeInstanceId]),
            side = this[ExchangeRequestItemsTable.side],
            createdAt = this[ExchangeRequestItemsTable.createdAt].toInstant().toKotlinInstant(),
        )
}

private fun kotlinx.datetime.Instant.toOffsetDateTime(): OffsetDateTime =
    OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)
