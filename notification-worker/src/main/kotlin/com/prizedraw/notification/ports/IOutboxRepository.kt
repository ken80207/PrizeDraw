package com.prizedraw.notification.ports

import com.prizedraw.domain.entities.OutboxEvent
import java.util.UUID

/**
 * Marker interface for domain events that can be enqueued into the outbox.
 *
 * Implementations carry the event type, aggregate identity, and serialisable payload.
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
 * produces them ([enqueue]). A separate background worker atomically claims PENDING events
 * ([claimPending]), publishes them to the message bus, then marks them processed
 * ([markProcessed]) or resets them for retry ([markFailedOrRetry]).
 */
public interface IOutboxRepository {
    /**
     * Persists a [DomainEvent] as a PENDING outbox event within the current transaction.
     *
     * @param event The domain event to enqueue.
     */
    public fun enqueue(event: DomainEvent)

    /**
     * Atomically claims up to [limit] PENDING events by transitioning them to IN_PROGRESS
     * in a single `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)` statement.
     *
     * Using `FOR UPDATE SKIP LOCKED` ensures that concurrent worker pods running a rolling
     * update each claim a disjoint batch, preventing duplicate event delivery.
     *
     * Also increments the `attempts` counter on each claimed row.
     *
     * @param limit Maximum number of events to claim per polling cycle.
     * @return The list of events now owned by this worker pod.
     */
    public suspend fun claimPending(limit: Int): List<OutboxEvent>

    /**
     * Marks the outbox event with the given [id] as PROCESSED.
     *
     * @param id The event id to mark as processed.
     */
    public suspend fun markProcessed(id: UUID)

    /**
     * Handles a processing failure.
     *
     * If [currentAttempts] is less than [MAX_ATTEMPTS], resets the event to PENDING so the
     * next polling cycle can re-claim it. Once [MAX_ATTEMPTS] is reached the event is
     * permanently marked FAILED.
     *
     * @param id The event id that failed.
     * @param reason Human-readable failure reason for debugging.
     * @param currentAttempts The `attempts` value recorded on the event when it was claimed.
     */
    public suspend fun markFailedOrRetry(
        id: UUID,
        reason: String,
        currentAttempts: Int,
    )

    public companion object {
        /** Maximum delivery attempts before an event is permanently marked FAILED. */
        public const val MAX_ATTEMPTS: Int = 5
    }
}
