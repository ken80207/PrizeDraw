package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.events.BuybackCompleted
import com.prizedraw.application.events.DrawCompleted
import com.prizedraw.application.events.ExchangeCompleted
import com.prizedraw.application.events.PaymentConfirmed
import com.prizedraw.application.events.PrizeTransferred
import com.prizedraw.application.events.ShippingStatusChanged
import com.prizedraw.application.events.SupportTicketReplied
import com.prizedraw.application.events.TradeCompleted
import com.prizedraw.application.events.WithdrawalStatusChanged
import com.prizedraw.application.ports.output.DomainEvent
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.domain.entities.OutboxEvent
import com.prizedraw.domain.entities.OutboxEventStatus
import com.prizedraw.infrastructure.persistence.tables.OutboxEventsTable
import kotlinx.datetime.toKotlinInstant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** Exposed-backed implementation of [IOutboxRepository]. */
public class OutboxRepositoryImpl : IOutboxRepository {
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Synchronous enqueue for use within an existing business transaction.
     *
     * W-3 fix: the full payload of the concrete [DomainEvent] subclass is serialized into
     * the `payload` column so the outbox worker has all fields available without hitting
     * the source tables again.
     */
    override fun enqueue(event: DomainEvent) {
        OutboxEventsTable.insert {
            it[eventType] = event.eventType
            it[aggregateId] = event.aggregateId
            it[payload] = serializeEvent(event)
            it[status] = OutboxEventStatus.PENDING.name
            it[attempts] = 0
            it[createdAt] = OffsetDateTime.now(ZoneOffset.UTC)
        }
    }

    override suspend fun fetchPending(limit: Int): List<OutboxEvent> =
        newSuspendedTransaction {
            OutboxEventsTable
                .selectAll()
                .where { OutboxEventsTable.status eq OutboxEventStatus.PENDING.name }
                .orderBy(OutboxEventsTable.createdAt, SortOrder.ASC)
                .limit(limit)
                .map { it.toOutboxEvent() }
        }

    override suspend fun markProcessed(id: UUID): Unit =
        newSuspendedTransaction {
            OutboxEventsTable.update({ OutboxEventsTable.id eq id }) {
                it[status] = OutboxEventStatus.PROCESSED.name
                it[processedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }

    override suspend fun markFailed(
        id: UUID,
        reason: String,
    ): Unit =
        newSuspendedTransaction {
            OutboxEventsTable.update({ OutboxEventsTable.id eq id }) {
                it[status] = OutboxEventStatus.FAILED.name
                it[lastError] = reason
            }
        }

    /**
     * Serializes all fields of the concrete [DomainEvent] subclass into a JSON string.
     *
     * Common envelope fields (eventType, aggregateType, aggregateId) are always included.
     * Each branch adds the subclass-specific fields so the outbox worker has the full payload.
     */
    @Suppress("CyclomaticComplexMethod", "LongMethod")
    private fun serializeEvent(event: DomainEvent): String {
        val obj =
            buildJsonObject {
                put("eventType", event.eventType)
                put("aggregateType", event.aggregateType)
                put("aggregateId", event.aggregateId.toString())
                when (event) {
                    is DrawCompleted -> {
                        put("ticketId", event.ticketId.toString())
                        put("playerId", event.playerId.toString())
                        put("prizeInstanceId", event.prizeInstanceId.toString())
                        put("campaignId", event.campaignId.toString())
                    }
                    is PrizeTransferred -> {
                        put("prizeInstanceId", event.prizeInstanceId.toString())
                        put("fromPlayerId", event.fromPlayerId.toString())
                        put("toPlayerId", event.toPlayerId.toString())
                    }
                    is TradeCompleted -> {
                        put("tradeOrderId", event.tradeOrderId.toString())
                        put("sellerId", event.sellerId.toString())
                        put("buyerId", event.buyerId.toString())
                        put("prizeInstanceId", event.prizeInstanceId.toString())
                        put("salePrice", event.salePrice)
                    }
                    is ExchangeCompleted -> {
                        put("exchangeRequestId", event.exchangeRequestId.toString())
                        put("initiatorId", event.initiatorId.toString())
                        put("recipientId", event.recipientId.toString())
                    }
                    is BuybackCompleted -> {
                        put("buybackRecordId", event.buybackRecordId.toString())
                        put("playerId", event.playerId.toString())
                        put("prizeInstanceId", event.prizeInstanceId.toString())
                        put("revenuePointsCredited", event.revenuePointsCredited)
                    }
                    is ShippingStatusChanged -> {
                        put("shippingOrderId", event.shippingOrderId.toString())
                        put("playerId", event.playerId.toString())
                        put("newStatus", event.newStatus)
                        put("trackingNumber", event.trackingNumber)
                    }
                    is PaymentConfirmed -> {
                        put("paymentOrderId", event.paymentOrderId.toString())
                        put("playerId", event.playerId.toString())
                        put("drawPointsGranted", event.drawPointsGranted)
                        put("fiatAmount", event.fiatAmount)
                    }
                    is WithdrawalStatusChanged -> {
                        put("withdrawalRequestId", event.withdrawalRequestId.toString())
                        put("playerId", event.playerId.toString())
                        put("newStatus", event.newStatus)
                    }
                    is SupportTicketReplied -> {
                        put("supportTicketId", event.supportTicketId.toString())
                        put("playerId", event.playerId.toString())
                        put("messageId", event.messageId.toString())
                    }
                }
            }
        return json.encodeToString(JsonObject.serializer(), obj)
    }

    private fun ResultRow.toOutboxEvent(): OutboxEvent =
        OutboxEvent(
            id = this[OutboxEventsTable.id],
            eventType = this[OutboxEventsTable.eventType],
            aggregateType = this[OutboxEventsTable.eventType].substringBefore("."),
            aggregateId = this[OutboxEventsTable.aggregateId],
            payload = json.parseToJsonElement(this[OutboxEventsTable.payload]) as JsonObject,
            status = OutboxEventStatus.valueOf(this[OutboxEventsTable.status]),
            processedAt = this[OutboxEventsTable.processedAt]?.toInstant()?.toKotlinInstant(),
            failureReason = this[OutboxEventsTable.lastError],
            createdAt = this[OutboxEventsTable.createdAt].toInstant().toKotlinInstant(),
        )
}
