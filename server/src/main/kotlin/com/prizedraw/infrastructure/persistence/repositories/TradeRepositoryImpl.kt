package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.ITradeRepository
import com.prizedraw.contracts.enums.TradeOrderStatus
import com.prizedraw.domain.entities.TradeListing
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import com.prizedraw.schema.tables.TradeOrdersTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

public class TradeRepositoryImpl : ITradeRepository {
    override suspend fun findById(id: UUID): TradeListing? =
        newSuspendedTransaction {
            TradeOrdersTable
                .selectAll()
                .where { TradeOrdersTable.id eq id }
                .singleOrNull()
                ?.toTradeListing()
        }

    override suspend fun findActiveListing(prizeInstanceId: PrizeInstanceId): TradeListing? =
        newSuspendedTransaction {
            TradeOrdersTable
                .selectAll()
                .where {
                    (TradeOrdersTable.prizeInstanceId eq prizeInstanceId.value) and
                        (TradeOrdersTable.status eq TradeOrderStatus.LISTED)
                }.singleOrNull()
                ?.toTradeListing()
        }

    override suspend fun findBySeller(
        sellerId: PlayerId,
        status: TradeOrderStatus?,
    ): List<TradeListing> =
        newSuspendedTransaction {
            TradeOrdersTable
                .selectAll()
                .where {
                    val baseCondition = TradeOrdersTable.sellerId eq sellerId.value
                    if (status != null) {
                        baseCondition and (TradeOrdersTable.status eq status)
                    } else {
                        baseCondition
                    }
                }.map { it.toTradeListing() }
        }

    override suspend fun findActiveListings(
        offset: Int,
        limit: Int,
    ): List<TradeListing> =
        newSuspendedTransaction {
            TradeOrdersTable
                .selectAll()
                .where {
                    (TradeOrdersTable.status eq TradeOrderStatus.LISTED) and
                        (TradeOrdersTable.deletedAt.isNull())
                }.orderBy(TradeOrdersTable.listedAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toTradeListing() }
        }

    override suspend fun save(listing: TradeListing): TradeListing =
        newSuspendedTransaction {
            val existing =
                TradeOrdersTable
                    .selectAll()
                    .where { TradeOrdersTable.id eq listing.id }
                    .singleOrNull()

            if (existing == null) {
                TradeOrdersTable.insert {
                    it[id] = listing.id
                    it[sellerId] = listing.sellerId.value
                    it[buyerId] = listing.buyerId?.value
                    it[prizeInstanceId] = listing.prizeInstanceId.value
                    it[listPrice] = listing.listPrice
                    it[feeRateBps] = listing.feeRateBps
                    it[feeAmount] = listing.feeAmount
                    it[sellerProceeds] = listing.sellerProceeds
                    it[status] = listing.status
                    it[listedAt] = listing.listedAt.toOffsetDateTime()
                    it[completedAt] = listing.completedAt?.toOffsetDateTime()
                    it[cancelledAt] = listing.cancelledAt?.toOffsetDateTime()
                    it[deletedAt] = listing.deletedAt?.toOffsetDateTime()
                    it[createdAt] = listing.createdAt.toOffsetDateTime()
                    it[updatedAt] = listing.updatedAt.toOffsetDateTime()
                }
            } else {
                TradeOrdersTable.update({ TradeOrdersTable.id eq listing.id }) {
                    it[buyerId] = listing.buyerId?.value
                    it[feeAmount] = listing.feeAmount
                    it[sellerProceeds] = listing.sellerProceeds
                    it[status] = listing.status
                    it[completedAt] = listing.completedAt?.toOffsetDateTime()
                    it[cancelledAt] = listing.cancelledAt?.toOffsetDateTime()
                    it[deletedAt] = listing.deletedAt?.toOffsetDateTime()
                    it[updatedAt] = listing.updatedAt.toOffsetDateTime()
                }
            }

            TradeOrdersTable
                .selectAll()
                .where { TradeOrdersTable.id eq listing.id }
                .single()
                .toTradeListing()
        }

    private fun ResultRow.toTradeListing(): TradeListing =
        TradeListing(
            id = this[TradeOrdersTable.id],
            sellerId = PlayerId(this[TradeOrdersTable.sellerId]),
            buyerId = this[TradeOrdersTable.buyerId]?.let { PlayerId(it) },
            prizeInstanceId = PrizeInstanceId(this[TradeOrdersTable.prizeInstanceId]),
            listPrice = this[TradeOrdersTable.listPrice],
            feeRateBps = this[TradeOrdersTable.feeRateBps],
            feeAmount = this[TradeOrdersTable.feeAmount],
            sellerProceeds = this[TradeOrdersTable.sellerProceeds],
            status = this[TradeOrdersTable.status],
            listedAt = this[TradeOrdersTable.listedAt].toInstant().toKotlinInstant(),
            completedAt = this[TradeOrdersTable.completedAt]?.toInstant()?.toKotlinInstant(),
            cancelledAt = this[TradeOrdersTable.cancelledAt]?.toInstant()?.toKotlinInstant(),
            deletedAt = this[TradeOrdersTable.deletedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[TradeOrdersTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[TradeOrdersTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

private fun kotlinx.datetime.Instant.toOffsetDateTime(): OffsetDateTime =
    OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)
