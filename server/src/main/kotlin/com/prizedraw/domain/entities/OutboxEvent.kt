package com.prizedraw.domain.entities

import kotlinx.datetime.Instant
import kotlinx.serialization.json.JsonObject
import java.util.UUID

/**
 * A domain event persisted to the outbox table for reliable async delivery.
 *
 * Implements the transactional outbox pattern: events are written to this table within
 * the same database transaction as the business operation that produces them. A background
 * worker polls for [OutboxEventStatus.PENDING] records and publishes them to the message
 * bus (Redis pub/sub, Kafka, etc.), then marks them [OutboxEventStatus.PROCESSED].
 *
 * @property id Surrogate primary key.
 * @property eventType Dot-namespaced event type key, e.g. `prize_instance.drawn`.
 * @property aggregateType The aggregate root type that emitted this event, e.g. `DrawTicket`.
 * @property aggregateId The primary key of the aggregate root instance.
 * @property payload Serialised event payload as a JSON object.
 * @property status Current processing state.
 * @property processedAt When this event was successfully published.
 * @property failureReason Error message if processing failed.
 * @property createdAt Creation timestamp (within the originating business transaction).
 */
public data class OutboxEvent(
    val id: UUID,
    val eventType: String,
    val aggregateType: String,
    val aggregateId: UUID,
    val payload: JsonObject,
    val status: OutboxEventStatus,
    val processedAt: Instant?,
    val failureReason: String?,
    val createdAt: Instant,
)

/**
 * Processing state of an [OutboxEvent].
 */
public enum class OutboxEventStatus {
    /** Event has been persisted but not yet published. */
    PENDING,

    /** Event has been successfully published to the message bus. */
    PROCESSED,

    /** Event failed to publish after maximum retry attempts. */
    FAILED,
}
