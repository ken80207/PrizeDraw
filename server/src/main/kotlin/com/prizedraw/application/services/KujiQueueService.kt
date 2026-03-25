package com.prizedraw.application.services

import com.prizedraw.application.ports.output.IQueueEntryRepository
import com.prizedraw.application.ports.output.IQueueRepository
import com.prizedraw.contracts.enums.QueueEntryStatus
import com.prizedraw.domain.entities.Queue
import com.prizedraw.domain.entities.QueueEntry
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.infrastructure.external.redis.DistributedLock
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.slf4j.LoggerFactory
import java.util.UUID
import kotlin.time.Duration.Companion.seconds

/**
 * Thrown when a queue operation cannot be completed due to state conflicts.
 */
public class QueueOperationException(
    message: String,
) : IllegalStateException(message)

/**
 * Application service managing the draw queue for each [com.prizedraw.domain.entities.TicketBox].
 *
 * All mutating operations acquire a per-box [DistributedLock] keyed as `queue:{boxId}` to
 * prevent race conditions under horizontal scaling. Queue updates are broadcast via
 * [RedisPubSub] on channel `queue:{boxId}` for WebSocket fanout.
 *
 * Session expiry is enforced by a coroutine timeout launched after [advanceQueue].
 * If the player finishes before expiry the timeout is a no-op (entry already terminal).
 *
 * @param distributedLock Lock provider.
 * @param queueRepository Queue aggregate root persistence.
 * @param queueEntryRepository Queue entry persistence.
 * @param redisPubSub Pub/sub bus for cross-instance broadcast.
 */
public class KujiQueueService(
    private val distributedLock: DistributedLock,
    private val queueRepository: IQueueRepository,
    private val queueEntryRepository: IQueueEntryRepository,
    private val redisPubSub: RedisPubSub,
) {
    private val log = LoggerFactory.getLogger(KujiQueueService::class.java)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /**
     * Joins the queue for the given ticket box.
     *
     * If the queue is idle the new entry is immediately activated; otherwise it joins
     * as WAITING. A new [Queue] row is created if none exists yet for the box.
     *
     * @param playerId The player joining the queue.
     * @param ticketBoxId The ticket box to queue for.
     * @param sessionSeconds Duration of an exclusive draw session in seconds.
     * @return The created [QueueEntry].
     * @throws QueueOperationException if the player already has an active entry.
     */
    public suspend fun joinQueue(
        playerId: PlayerId,
        ticketBoxId: UUID,
        sessionSeconds: Int,
    ): QueueEntry {
        val result =
            distributedLock.withLock("queue:$ticketBoxId") {
                val queue = getOrCreateQueue(ticketBoxId)
                val existingEntry = queueEntryRepository.findActiveEntry(queue.id, playerId)
                if (existingEntry != null) {
                    throw QueueOperationException(
                        "Player ${playerId.value} already has an active entry in queue ${queue.id}",
                    )
                }
                val activeEntries = queueEntryRepository.findActiveEntries(queue.id)
                val position = (activeEntries.maxOfOrNull { it.position } ?: 0) + 1
                val now = Clock.System.now()
                val entry =
                    QueueEntry(
                        id = UUID.randomUUID(),
                        queueId = queue.id,
                        playerId = playerId,
                        position = position,
                        status = QueueEntryStatus.WAITING,
                        joinedAt = now,
                        activatedAt = null,
                        completedAt = null,
                        createdAt = now,
                        updatedAt = now,
                    )
                val saved = queueEntryRepository.save(entry)
                if (queue.isIdle()) {
                    activateEntry(saved, queue, sessionSeconds)
                } else {
                    publishQueueUpdate(ticketBoxId, queue)
                    saved
                }
            } ?: throw QueueOperationException("Failed to acquire queue lock for box $ticketBoxId")

        return result
    }

    /**
     * Advances the queue by activating the next WAITING entry.
     *
     * Sets the entry to ACTIVE, updates [Queue.activePlayerId] and session timestamps,
     * and schedules a session expiry coroutine.
     *
     * @param ticketBoxId The ticket box whose queue to advance.
     * @param sessionSeconds Session duration in seconds.
     */
    public suspend fun advanceQueue(
        ticketBoxId: UUID,
        sessionSeconds: Int,
    ) {
        distributedLock.withLock("queue:$ticketBoxId") {
            val queue = queueRepository.findByTicketBoxId(ticketBoxId) ?: return@withLock
            val nextEntry =
                queueEntryRepository.findNextWaiting(queue.id) ?: run {
                    val idleQueue =
                        queue.copy(
                            activePlayerId = null,
                            sessionStartedAt = null,
                            sessionExpiresAt = null,
                            updatedAt = Clock.System.now(),
                        )
                    queueRepository.save(idleQueue)
                    publishQueueUpdate(ticketBoxId, idleQueue)
                    return@withLock
                }
            activateEntry(nextEntry, queue, sessionSeconds)
        }
    }

    /**
     * Expires the session for a queue entry that has timed out.
     *
     * Marks the entry COMPLETED and advances the queue to the next waiting player.
     *
     * @param ticketBoxId The ticket box.
     * @param queueEntryId The entry whose session expired.
     * @param sessionSeconds Session duration for the next player.
     */
    public suspend fun expireSession(
        ticketBoxId: UUID,
        queueEntryId: UUID,
        sessionSeconds: Int,
    ) {
        distributedLock.withLock("queue:$ticketBoxId") {
            val entry = queueEntryRepository.findById(queueEntryId) ?: return@withLock
            if (entry.isTerminal()) {
                return@withLock
            }
            val now = Clock.System.now()
            val expired =
                entry.copy(
                    status = QueueEntryStatus.EVICTED,
                    completedAt = now,
                    updatedAt = now,
                )
            queueEntryRepository.save(expired)
            log.info("Session expired for entry $queueEntryId in box $ticketBoxId")
        }
        advanceQueue(ticketBoxId, sessionSeconds)
    }

    /**
     * Removes a player from the queue.
     *
     * WAITING entries are marked ABANDONED; ACTIVE entries are marked COMPLETED and
     * the queue is advanced to the next waiting player.
     *
     * @param playerId The player leaving.
     * @param ticketBoxId The ticket box queue to leave.
     * @param sessionSeconds Session duration for the next player (used if active).
     */
    public suspend fun leaveQueue(
        playerId: PlayerId,
        ticketBoxId: UUID,
        sessionSeconds: Int,
    ) {
        var wasActive = false
        distributedLock.withLock("queue:$ticketBoxId") {
            val queue = queueRepository.findByTicketBoxId(ticketBoxId) ?: return@withLock
            val entry = queueEntryRepository.findActiveEntry(queue.id, playerId) ?: return@withLock
            val now = Clock.System.now()
            val newStatus =
                if (entry.status == QueueEntryStatus.ACTIVE) {
                    wasActive = true
                    QueueEntryStatus.COMPLETED
                } else {
                    QueueEntryStatus.ABANDONED
                }
            val updated = entry.copy(status = newStatus, completedAt = now, updatedAt = now)
            queueEntryRepository.save(updated)
            publishQueueUpdate(ticketBoxId, queue)
        }
        if (wasActive) {
            advanceQueue(ticketBoxId, sessionSeconds)
        }
    }

    /**
     * Moves a player from one box queue to another atomically.
     *
     * Leaves [fromBoxId] and joins [toBoxId] in sequence. Each operation acquires
     * its own lock; the overall action is not a single atomic transaction across
     * both boxes, but the net result is consistent.
     *
     * @param playerId The player switching boxes.
     * @param fromBoxId The box to leave.
     * @param toBoxId The box to join.
     * @param sessionSeconds Session duration for both queues.
     * @return The new [QueueEntry] in [toBoxId].
     */
    public suspend fun switchBox(
        playerId: PlayerId,
        fromBoxId: UUID,
        toBoxId: UUID,
        sessionSeconds: Int,
    ): QueueEntry {
        leaveQueue(playerId, fromBoxId, sessionSeconds)
        return joinQueue(playerId, toBoxId, sessionSeconds)
    }

    // --- Private helpers ---

    private suspend fun getOrCreateQueue(ticketBoxId: UUID): Queue {
        val existing = queueRepository.findByTicketBoxId(ticketBoxId)
        if (existing != null) {
            return existing
        }
        val now = Clock.System.now()
        val queue =
            Queue(
                id = UUID.randomUUID(),
                ticketBoxId = ticketBoxId,
                activePlayerId = null,
                sessionStartedAt = null,
                sessionExpiresAt = null,
                createdAt = now,
                updatedAt = now,
            )
        return queueRepository.save(queue)
    }

    private suspend fun activateEntry(
        entry: QueueEntry,
        queue: Queue,
        sessionSeconds: Int,
    ): QueueEntry {
        val now = Clock.System.now()
        val expiresAt = now.plus(sessionSeconds.seconds)
        val activated =
            entry.copy(
                status = QueueEntryStatus.ACTIVE,
                activatedAt = now,
                updatedAt = now,
            )
        queueEntryRepository.save(activated)
        val updatedQueue =
            queue.copy(
                activePlayerId = entry.playerId,
                sessionStartedAt = now,
                sessionExpiresAt = expiresAt,
                updatedAt = now,
            )
        queueRepository.save(updatedQueue)
        scheduleExpiry(queue.ticketBoxId, entry.id, sessionSeconds)
        publishQueueUpdate(queue.ticketBoxId, updatedQueue)
        return activated
    }

    @Suppress("TooGenericExceptionCaught")
    private fun scheduleExpiry(
        ticketBoxId: UUID,
        entryId: UUID,
        sessionSeconds: Int,
    ) {
        scope.launch {
            delay(sessionSeconds.seconds)
            try {
                expireSession(ticketBoxId, entryId, sessionSeconds)
            } catch (e: Exception) {
                log.error("Error expiring session for entry $entryId in box $ticketBoxId", e)
            }
        }
    }

    private suspend fun publishQueueUpdate(
        ticketBoxId: UUID,
        queue: Queue,
    ) {
        val activeEntries = queueEntryRepository.findActiveEntries(queue.id)
        val payload =
            buildJsonObject {
                put("ticketBoxId", ticketBoxId.toString())
                put("activePlayerId", queue.activePlayerId?.value?.toString())
                put("queueLength", activeEntries.size)
                put("sessionExpiresAt", queue.sessionExpiresAt?.toString())
            }
        redisPubSub.publish("queue:$ticketBoxId", payload.toString())
    }
}
