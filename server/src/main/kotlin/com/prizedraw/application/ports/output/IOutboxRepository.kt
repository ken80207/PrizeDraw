package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.OutboxEvent
import java.util.UUID

/**
 * Marker interface for domain events that can be enqueued into the outbox.
 *
 * Implementations carry the event type, aggregate identity, and serialisable payload.
 * The outbox worker serialises these to [OutboxEvent] records via [IOutboxRepository.enqueue].
 */
public interface DomainEvent {
    /** Dot-namespaced event type key, e.g. `prize_instance.drawn`. */
    public val eventType: String

    /** The aggregate root type name, e.g. `DrawTicket`. */
    public val aggregateType: String

    /** The primary key of the aggregate root instance. */
    public val aggregateId: UUID
}

/**
 * Output port for the transactional outbox pattern.
 *
 * Events are enqueued within the same database transaction as the business operation that
 * produces them ([enqueue]). A separate background worker polls for PENDING events
 * ([fetchPending]) and publishes them to the message bus, then marks them processed
 * ([markProcessed]).
 *
 * All operations are synchronous to support usage within Exposed's transaction DSL.
 */
public interface IOutboxRepository {
    /**
     * Persists a [DomainEvent] as a PENDING [OutboxEvent] within the current transaction.
     *
     * @param event The domain event to enqueue.
     */
    public fun enqueue(event: DomainEvent)

    /**
     * Returns up to [limit] PENDING [OutboxEvent]s ordered by creation time ascending.
     *
     * This is called by the background outbox worker on each polling cycle.
     *
     * @param limit Maximum number of pending events to fetch per cycle.
     * @return List of pending outbox events.
     */
    public suspend fun fetchPending(limit: Int): List<OutboxEvent>

    /**
     * Marks the outbox event with the given [id] as PROCESSED.
     *
     * Called by the outbox worker after successfully publishing the event to the message bus.
     *
     * @param id The [OutboxEvent.id] to mark as processed.
     */
    public suspend fun markProcessed(id: UUID)

    /**
     * Marks the outbox event with the given [id] as FAILED.
     *
     * Called by the outbox worker when an event has exceeded the maximum retry attempts.
     *
     * @param id The [OutboxEvent.id] to mark as failed.
     * @param reason Human-readable failure reason for debugging.
     */
    public suspend fun markFailed(
        id: UUID,
        reason: String,
    )
}
