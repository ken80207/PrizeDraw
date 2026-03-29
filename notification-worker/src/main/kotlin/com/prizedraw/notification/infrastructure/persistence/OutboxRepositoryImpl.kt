package com.prizedraw.notification.infrastructure.persistence

import com.prizedraw.domain.entities.OutboxEvent
import com.prizedraw.domain.entities.OutboxEventStatus
import com.prizedraw.notification.infrastructure.persistence.inTransaction
import com.prizedraw.notification.ports.DomainEvent
import com.prizedraw.notification.ports.IOutboxRepository
import com.prizedraw.notification.worker.BuybackCompleted
import com.prizedraw.notification.worker.DrawCompleted
import com.prizedraw.notification.worker.ExchangeCompleted
import com.prizedraw.notification.worker.FavoriteCampaignLowStock
import com.prizedraw.notification.worker.PaymentConfirmed
import com.prizedraw.notification.worker.PrizeTransferred
import com.prizedraw.notification.worker.ShippingStatusChanged
import com.prizedraw.notification.worker.SupportTicketReplied
import com.prizedraw.notification.worker.TradeCompleted
import com.prizedraw.notification.worker.WithdrawalStatusChanged
import com.prizedraw.schema.tables.OutboxEventsTable
import kotlinx.datetime.toKotlinInstant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.sql.ResultSet
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** Exposed-backed implementation of [IOutboxRepository]. */
public class OutboxRepositoryImpl : IOutboxRepository {
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Synchronous enqueue for use within an existing business transaction.
     *
     * The full payload of the concrete [DomainEvent] subclass is serialized into
     * the `payload` column so the outbox worker has all fields available without
     * hitting the source tables again.
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

    /**
     * Atomically claims up to [limit] PENDING events using a single
     * `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` statement.
     *
     * `FOR UPDATE SKIP LOCKED` ensures concurrent pods each receive a disjoint
     * batch, preventing duplicate delivery during rolling updates. The `attempts`
     * counter is incremented in the same statement so it is always in sync with
     * the current delivery attempt when the worker processes the event.
     */
    override suspend fun claimPending(limit: Int): List<OutboxEvent> =
        newSuspendedTransaction {
            @Suppress("MultilineRawStringIndentation")
            val sql =
                """
                UPDATE outbox_events
                SET status = '${OutboxEventStatus.IN_PROGRESS.name}', attempts = attempts + 1
                WHERE id IN (
                    SELECT id FROM outbox_events
                    WHERE status = '${OutboxEventStatus.PENDING.name}'
                    ORDER BY created_at ASC
                    LIMIT $limit
                    FOR UPDATE SKIP LOCKED
                )
                RETURNING id, event_type, aggregate_id, payload, status, attempts,
                          last_error, created_at, processed_at
                """.trimIndent()

            val result = mutableListOf<OutboxEvent>()
            exec(sql) { rs ->
                while (rs.next()) {
                    result.add(rs.toOutboxEvent())
                }
            }
            result
        }

    override suspend fun markProcessed(id: UUID): Unit =
        inTransaction {
            OutboxEventsTable.update({ OutboxEventsTable.id eq id }) {
                it[status] = OutboxEventStatus.PROCESSED.name
                it[processedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }

    /**
     * On failure, resets the event to PENDING if further retries remain, or permanently
     * marks it FAILED once [IOutboxRepository.MAX_ATTEMPTS] has been exhausted.
     *
     * Resetting to PENDING (rather than leaving it IN_PROGRESS) means the event will be
     * re-claimed on the next polling cycle by whichever pod picks it up next.
     */
    override suspend fun markFailedOrRetry(
        id: UUID,
        reason: String,
        currentAttempts: Int,
    ): Unit =
        inTransaction {
            if (currentAttempts >= IOutboxRepository.MAX_ATTEMPTS) {
                OutboxEventsTable.update({ OutboxEventsTable.id eq id }) {
                    it[status] = OutboxEventStatus.FAILED.name
                    it[lastError] = reason
                }
            } else {
                OutboxEventsTable.update({ OutboxEventsTable.id eq id }) {
                    it[status] = OutboxEventStatus.PENDING.name
                    it[lastError] = reason
                }
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
                    is FavoriteCampaignLowStock -> {
                        put("campaignId", event.campaignId.toString())
                        put("playerId", event.playerId.toString())
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
            attempts = this[OutboxEventsTable.attempts],
            processedAt = this[OutboxEventsTable.processedAt]?.toInstant()?.toKotlinInstant(),
            failureReason = this[OutboxEventsTable.lastError],
            createdAt = this[OutboxEventsTable.createdAt].toInstant().toKotlinInstant(),
        )

    /**
     * Maps a raw JDBC [ResultSet] row from the `RETURNING *` clause back to an [OutboxEvent].
     *
     * Column names match those defined in [OutboxEventsTable] and the underlying DB schema.
     */
    private fun ResultSet.toOutboxEvent(): OutboxEvent {
        val eventType = getString("event_type")
        return OutboxEvent(
            id = getObject("id", java.util.UUID::class.java),
            eventType = eventType,
            aggregateType = eventType.substringBefore("."),
            aggregateId = getObject("aggregate_id", java.util.UUID::class.java),
            payload = json.parseToJsonElement(getString("payload")) as JsonObject,
            status = OutboxEventStatus.valueOf(getString("status")),
            attempts = getInt("attempts"),
            processedAt = getTimestamp("processed_at")?.toInstant()?.toKotlinInstant(),
            failureReason = getString("last_error"),
            createdAt = getTimestamp("created_at").toInstant().toKotlinInstant(),
        )
    }
}
