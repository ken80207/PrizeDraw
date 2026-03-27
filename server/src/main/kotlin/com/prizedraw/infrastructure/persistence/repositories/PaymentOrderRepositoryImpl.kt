package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IPaymentOrderRepository
import com.prizedraw.domain.entities.PaymentOrder
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.infrastructure.persistence.tables.PaymentOrdersTable
import kotlinx.datetime.Instant
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/**
 * Exposed-backed implementation of [IPaymentOrderRepository].
 */
public class PaymentOrderRepositoryImpl : IPaymentOrderRepository {
    override suspend fun findById(id: UUID): PaymentOrder? =
        newSuspendedTransaction {
            PaymentOrdersTable
                .selectAll()
                .where { PaymentOrdersTable.id eq id }
                .singleOrNull()
                ?.toPaymentOrder()
        }

    override suspend fun findByGatewayTransactionId(gatewayTransactionId: String): PaymentOrder? =
        newSuspendedTransaction {
            PaymentOrdersTable
                .selectAll()
                .where { PaymentOrdersTable.gatewayTransactionId eq gatewayTransactionId }
                .singleOrNull()
                ?.toPaymentOrder()
        }

    override suspend fun save(order: PaymentOrder): PaymentOrder =
        newSuspendedTransaction {
            val existing =
                PaymentOrdersTable
                    .selectAll()
                    .where { PaymentOrdersTable.id eq order.id }
                    .singleOrNull()

            val metadataJson = order.gatewayMetadata.toString()

            if (existing == null) {
                PaymentOrdersTable.insert {
                    it[id] = order.id
                    it[playerId] = order.playerId.value
                    it[fiatAmount] = order.fiatAmount
                    it[currencyCode] = order.currencyCode
                    it[drawPointsGranted] = order.drawPointsGranted
                    it[gateway] = order.gateway
                    it[gatewayTransactionId] = order.gatewayTransactionId
                    it[paymentMethod] = order.paymentMethod
                    it[gatewayMetadata] = metadataJson
                    it[status] = order.status
                    it[paidAt] = order.paidAt?.toOffsetDateTime()
                    it[failedAt] = order.failedAt?.toOffsetDateTime()
                    it[refundedAt] = order.refundedAt?.toOffsetDateTime()
                    it[expiresAt] = order.expiresAt?.toOffsetDateTime()
                    it[createdAt] = order.createdAt.toOffsetDateTime()
                    it[updatedAt] = order.updatedAt.toOffsetDateTime()
                }
            } else {
                PaymentOrdersTable.update({ PaymentOrdersTable.id eq order.id }) {
                    it[gatewayTransactionId] = order.gatewayTransactionId
                    it[paymentMethod] = order.paymentMethod
                    it[gatewayMetadata] = metadataJson
                    it[status] = order.status
                    it[paidAt] = order.paidAt?.toOffsetDateTime()
                    it[failedAt] = order.failedAt?.toOffsetDateTime()
                    it[refundedAt] = order.refundedAt?.toOffsetDateTime()
                    it[expiresAt] = order.expiresAt?.toOffsetDateTime()
                    it[updatedAt] = order.updatedAt.toOffsetDateTime()
                }
            }

            PaymentOrdersTable
                .selectAll()
                .where { PaymentOrdersTable.id eq order.id }
                .single()
                .toPaymentOrder()
        }

    override suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<PaymentOrder> =
        newSuspendedTransaction {
            PaymentOrdersTable
                .selectAll()
                .where { PaymentOrdersTable.playerId eq playerId.value }
                .orderBy(PaymentOrdersTable.createdAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toPaymentOrder() }
        }

    private fun ResultRow.toPaymentOrder(): PaymentOrder =
        PaymentOrder(
            id = this[PaymentOrdersTable.id],
            playerId = PlayerId(this[PaymentOrdersTable.playerId]),
            fiatAmount = this[PaymentOrdersTable.fiatAmount],
            currencyCode = this[PaymentOrdersTable.currencyCode],
            drawPointsGranted = this[PaymentOrdersTable.drawPointsGranted],
            gateway = this[PaymentOrdersTable.gateway],
            gatewayTransactionId = this[PaymentOrdersTable.gatewayTransactionId],
            paymentMethod = this[PaymentOrdersTable.paymentMethod],
            gatewayMetadata =
                runCatching {
                    Json.parseToJsonElement(this[PaymentOrdersTable.gatewayMetadata]) as JsonObject
                }.getOrElse { JsonObject(emptyMap()) },
            status = this[PaymentOrdersTable.status],
            paidAt = this[PaymentOrdersTable.paidAt]?.toInstant()?.toKotlinInstant(),
            failedAt = this[PaymentOrdersTable.failedAt]?.toInstant()?.toKotlinInstant(),
            refundedAt = this[PaymentOrdersTable.refundedAt]?.toInstant()?.toKotlinInstant(),
            expiresAt = this[PaymentOrdersTable.expiresAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[PaymentOrdersTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PaymentOrdersTable.updatedAt].toInstant().toKotlinInstant(),
        )

    private fun Instant.toOffsetDateTime(): OffsetDateTime = OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)
}
