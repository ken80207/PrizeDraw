package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IShippingRepository
import com.prizedraw.contracts.enums.ShippingOrderStatus
import com.prizedraw.domain.entities.ShippingOrder
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import com.prizedraw.schema.tables.ShippingOrdersTable
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

public class ShippingRepositoryImpl : IShippingRepository {
    override suspend fun findById(id: UUID): ShippingOrder? =
        newSuspendedTransaction {
            ShippingOrdersTable
                .selectAll()
                .where { ShippingOrdersTable.id eq id }
                .singleOrNull()
                ?.toShippingOrder()
        }

    override suspend fun findByPrizeInstance(prizeInstanceId: PrizeInstanceId): ShippingOrder? =
        newSuspendedTransaction {
            ShippingOrdersTable
                .selectAll()
                .where { ShippingOrdersTable.prizeInstanceId eq prizeInstanceId.value }
                .singleOrNull()
                ?.toShippingOrder()
        }

    override suspend fun findByPlayer(
        playerId: PlayerId,
        status: ShippingOrderStatus?,
        offset: Int,
        limit: Int,
    ): List<ShippingOrder> =
        newSuspendedTransaction {
            ShippingOrdersTable
                .selectAll()
                .where {
                    val base = ShippingOrdersTable.playerId eq playerId.value
                    if (status != null) {
                        base and (ShippingOrdersTable.status eq status)
                    } else {
                        base
                    }
                }.orderBy(ShippingOrdersTable.createdAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toShippingOrder() }
        }

    override suspend fun findByStatus(
        status: ShippingOrderStatus,
        offset: Int,
        limit: Int,
    ): List<ShippingOrder> =
        newSuspendedTransaction {
            ShippingOrdersTable
                .selectAll()
                .where { ShippingOrdersTable.status eq status }
                .orderBy(ShippingOrdersTable.createdAt, org.jetbrains.exposed.sql.SortOrder.ASC)
                .limit(limit, offset.toLong())
                .map { it.toShippingOrder() }
        }

    override suspend fun save(order: ShippingOrder): ShippingOrder =
        newSuspendedTransaction {
            val existing =
                ShippingOrdersTable
                    .selectAll()
                    .where { ShippingOrdersTable.id eq order.id }
                    .singleOrNull()

            if (existing == null) {
                ShippingOrdersTable.insert {
                    it[id] = order.id
                    it[playerId] = order.playerId.value
                    it[prizeInstanceId] = order.prizeInstanceId.value
                    it[recipientName] = order.recipientName
                    it[recipientPhone] = order.recipientPhone
                    it[addressLine1] = order.addressLine1
                    it[addressLine2] = order.addressLine2
                    it[city] = order.city
                    it[postalCode] = order.postalCode
                    it[countryCode] = order.countryCode
                    it[trackingNumber] = order.trackingNumber
                    it[carrier] = order.carrier
                    it[status] = order.status
                    it[shippedAt] = order.shippedAt?.toOffsetDateTime()
                    it[deliveredAt] = order.deliveredAt?.toOffsetDateTime()
                    it[cancelledAt] = order.cancelledAt?.toOffsetDateTime()
                    it[fulfilledByStaffId] = order.fulfilledByStaffId
                    it[createdAt] = order.createdAt.toOffsetDateTime()
                    it[updatedAt] = order.updatedAt.toOffsetDateTime()
                }
            } else {
                ShippingOrdersTable.update({ ShippingOrdersTable.id eq order.id }) {
                    it[trackingNumber] = order.trackingNumber
                    it[carrier] = order.carrier
                    it[status] = order.status
                    it[shippedAt] = order.shippedAt?.toOffsetDateTime()
                    it[deliveredAt] = order.deliveredAt?.toOffsetDateTime()
                    it[cancelledAt] = order.cancelledAt?.toOffsetDateTime()
                    it[fulfilledByStaffId] = order.fulfilledByStaffId
                    it[updatedAt] = order.updatedAt.toOffsetDateTime()
                }
            }

            ShippingOrdersTable
                .selectAll()
                .where { ShippingOrdersTable.id eq order.id }
                .single()
                .toShippingOrder()
        }

    private fun ResultRow.toShippingOrder(): ShippingOrder =
        ShippingOrder(
            id = this[ShippingOrdersTable.id],
            playerId = PlayerId(this[ShippingOrdersTable.playerId]),
            prizeInstanceId = PrizeInstanceId(this[ShippingOrdersTable.prizeInstanceId]),
            recipientName = this[ShippingOrdersTable.recipientName],
            recipientPhone = this[ShippingOrdersTable.recipientPhone],
            addressLine1 = this[ShippingOrdersTable.addressLine1],
            addressLine2 = this[ShippingOrdersTable.addressLine2],
            city = this[ShippingOrdersTable.city],
            postalCode = this[ShippingOrdersTable.postalCode],
            countryCode = this[ShippingOrdersTable.countryCode].trim(),
            trackingNumber = this[ShippingOrdersTable.trackingNumber],
            carrier = this[ShippingOrdersTable.carrier],
            status = this[ShippingOrdersTable.status],
            shippedAt = this[ShippingOrdersTable.shippedAt]?.toInstant()?.toKotlinInstant(),
            deliveredAt = this[ShippingOrdersTable.deliveredAt]?.toInstant()?.toKotlinInstant(),
            cancelledAt = this[ShippingOrdersTable.cancelledAt]?.toInstant()?.toKotlinInstant(),
            fulfilledByStaffId = this[ShippingOrdersTable.fulfilledByStaffId],
            createdAt = this[ShippingOrdersTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[ShippingOrdersTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

private fun kotlinx.datetime.Instant.toOffsetDateTime(): OffsetDateTime =
    OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)
