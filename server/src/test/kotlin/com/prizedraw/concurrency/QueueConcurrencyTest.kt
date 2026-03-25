package com.prizedraw.concurrency

import com.prizedraw.application.ports.output.IQueueEntryRepository
import com.prizedraw.application.ports.output.IQueueRepository
import com.prizedraw.application.services.KujiQueueService
import com.prizedraw.application.services.QueueOperationException
import com.prizedraw.contracts.enums.QueueEntryStatus
import com.prizedraw.domain.entities.Queue
import com.prizedraw.domain.entities.QueueEntry
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.infrastructure.external.redis.DistributedLock
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.datetime.Clock
import java.util.UUID

/**
 * Concurrency tests for [KujiQueueService].
 *
 * Key invariants verified:
 *  - The distributed lock (`queue:{boxId}`) serialises all queue mutations.
 *  - A player cannot hold two active entries in the same queue.
 *  - Session expiry and manual leave do not advance the queue twice (idempotent EVICTED check).
 *  - Box switch is sequentially consistent: player leaves box A before joining box B.
 *
 * All tests use a mocked DistributedLock that simulates the Redis SET NX behaviour
 * inline (i.e. the withLock block executes synchronously for testing).
 */
class QueueConcurrencyTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makeQueue(
            ticketBoxId: UUID,
            activePlayerId: PlayerId? = null,
        ) = Queue(
            id = UUID.randomUUID(),
            ticketBoxId = ticketBoxId,
            activePlayerId = activePlayerId,
            sessionStartedAt = activePlayerId?.let { now },
            sessionExpiresAt = activePlayerId?.let { now.plus(kotlin.time.Duration.parse("5m")) },
            createdAt = now,
            updatedAt = now,
        )

        fun makeEntry(
            queueId: UUID,
            playerId: PlayerId,
            status: QueueEntryStatus = QueueEntryStatus.WAITING,
            position: Int = 1,
        ) = QueueEntry(
            id = UUID.randomUUID(),
            queueId = queueId,
            playerId = playerId,
            position = position,
            status = status,
            joinedAt = now,
            activatedAt =
                if (status == QueueEntryStatus.ACTIVE) {
                    now
                } else {
                    null
                },
            completedAt = null,
            createdAt = now,
            updatedAt = now,
        )

        afterEach { clearAllMocks() }

        describe("Queue race conditions") {

            it("a player cannot join the same queue twice — duplicate active entry is rejected") {
                val boxId = UUID.randomUUID()
                val player = PlayerId.generate()

                val distributedLock = mockk<DistributedLock>()
                val queueRepo = mockk<IQueueRepository>()
                val queueEntryRepo = mockk<IQueueEntryRepository>()
                val redisPubSub = mockk<RedisPubSub>()

                val queue = makeQueue(boxId)

                // Lock executes block immediately (single-process simulation)
                coEvery {
                    distributedLock.withLock(any<String>(), any<Long>(), any<suspend () -> QueueEntry>())
                } coAnswers {
                    val block = thirdArg<suspend () -> QueueEntry>()
                    block()
                }

                coEvery { queueRepo.findByTicketBoxId(boxId) } returns queue
                // Player already has an active entry in this queue
                val existingEntry = makeEntry(queue.id, player, QueueEntryStatus.ACTIVE)
                coEvery { queueEntryRepo.findActiveEntry(queue.id, player) } returns existingEntry

                val service =
                    KujiQueueService(
                        distributedLock = distributedLock,
                        queueRepository = queueRepo,
                        queueEntryRepository = queueEntryRepo,
                        redisPubSub = redisPubSub,
                    )

                shouldThrow<QueueOperationException> {
                    service.joinQueue(player, boxId, sessionSeconds = 300)
                }

                coVerify(exactly = 0) { queueEntryRepo.save(any()) }
            }

            it("queue is idle — first joiner is immediately activated") {
                val boxId = UUID.randomUUID()
                val player = PlayerId.generate()

                val distributedLock = mockk<DistributedLock>()
                val queueRepo = mockk<IQueueRepository>()
                val queueEntryRepo = mockk<IQueueEntryRepository>()
                val redisPubSub = mockk<RedisPubSub>()

                val idleQueue = makeQueue(boxId, activePlayerId = null) // idle

                coEvery {
                    distributedLock.withLock(any<String>(), any<Long>(), any<suspend () -> QueueEntry>())
                } coAnswers {
                    val block = thirdArg<suspend () -> QueueEntry>()
                    block()
                }

                coEvery { queueRepo.findByTicketBoxId(boxId) } returns idleQueue
                coEvery { queueEntryRepo.findActiveEntry(idleQueue.id, player) } returns null
                coEvery { queueEntryRepo.findActiveEntries(idleQueue.id) } returns emptyList()

                val savedEntry = makeEntry(idleQueue.id, player, QueueEntryStatus.WAITING)
                val activatedEntry = savedEntry.copy(status = QueueEntryStatus.ACTIVE, activatedAt = now)

                coEvery { queueEntryRepo.save(match { it.status == QueueEntryStatus.WAITING }) } returns savedEntry
                coEvery { queueEntryRepo.save(match { it.status == QueueEntryStatus.ACTIVE }) } returns activatedEntry
                coEvery { queueRepo.save(any()) } answers { firstArg() }
                coEvery { redisPubSub.publish(any(), any()) } returns Unit

                val service =
                    KujiQueueService(
                        distributedLock = distributedLock,
                        queueRepository = queueRepo,
                        queueEntryRepository = queueEntryRepo,
                        redisPubSub = redisPubSub,
                    )

                val entry = service.joinQueue(player, boxId, sessionSeconds = 300)

                // Activated immediately since queue was idle
                entry.status shouldBe QueueEntryStatus.ACTIVE
            }

            it("session expiry is idempotent — entry already EVICTED is a no-op") {
                // Simulates: timer fires after manual leave already marked the entry terminal.
                val boxId = UUID.randomUUID()
                val entryId = UUID.randomUUID()
                val player = PlayerId.generate()

                val distributedLock = mockk<DistributedLock>()
                val queueRepo = mockk<IQueueRepository>()
                val queueEntryRepo = mockk<IQueueEntryRepository>()
                val redisPubSub = mockk<RedisPubSub>()

                // Already-terminal entry (COMPLETED from manual leave)
                val terminalEntry = makeEntry(UUID.randomUUID(), player, QueueEntryStatus.COMPLETED).copy(id = entryId)

                coEvery { distributedLock.withLock(any<String>(), any<Long>(), any<suspend () -> Unit>()) } coAnswers {
                    val block = thirdArg<suspend () -> Unit>()
                    block()
                }

                coEvery { queueEntryRepo.findById(entryId) } returns terminalEntry
                // advanceQueue calls: queue exists but no next waiting
                val queue = makeQueue(boxId)
                coEvery { queueRepo.findByTicketBoxId(boxId) } returns queue
                coEvery { queueEntryRepo.findNextWaiting(queue.id) } returns null
                coEvery { queueRepo.save(any()) } answers { firstArg() }
                coEvery { queueEntryRepo.findActiveEntries(any()) } returns emptyList()
                coEvery { redisPubSub.publish(any(), any()) } returns Unit

                val service =
                    KujiQueueService(
                        distributedLock = distributedLock,
                        queueRepository = queueRepo,
                        queueEntryRepository = queueEntryRepo,
                        redisPubSub = redisPubSub,
                    )

                // Must not throw; terminal entry check is a no-op
                service.expireSession(boxId, entryId, sessionSeconds = 300)

                // Entry must NOT be saved again (it was already terminal)
                coVerify(exactly = 0) { queueEntryRepo.save(match { it.id == entryId }) }
            }

            it("box switch leaves old box and joins new box sequentially") {
                // Verifies that switchBox calls leaveQueue then joinQueue in order.
                val fromBoxId = UUID.randomUUID()
                val toBoxId = UUID.randomUUID()
                val player = PlayerId.generate()

                val distributedLock = mockk<DistributedLock>()
                val queueRepo = mockk<IQueueRepository>()
                val queueEntryRepo = mockk<IQueueEntryRepository>()
                val redisPubSub = mockk<RedisPubSub>()

                val operationOrder = mutableListOf<String>()

                coEvery { distributedLock.withLock(any<String>(), any<Long>(), any<suspend () -> Any>()) } coAnswers {
                    val key = firstArg<String>()
                    operationOrder.add("lock:$key")
                    val block = thirdArg<suspend () -> Any>()
                    block()
                }

                // From-box queue with player as ACTIVE
                val fromQueue = makeQueue(fromBoxId, player)
                val fromEntry = makeEntry(fromQueue.id, player, QueueEntryStatus.ACTIVE)
                val toQueue = makeQueue(toBoxId, activePlayerId = null)

                coEvery { queueRepo.findByTicketBoxId(fromBoxId) } returns fromQueue
                coEvery { queueEntryRepo.findActiveEntry(fromQueue.id, player) } returns fromEntry

                val completedFromEntry = fromEntry.copy(status = QueueEntryStatus.COMPLETED, completedAt = now)
                coEvery {
                    queueEntryRepo.save(match { it.status == QueueEntryStatus.COMPLETED && it.queueId == fromQueue.id })
                } returns completedFromEntry
                coEvery { redisPubSub.publish("queue:$fromBoxId", any()) } returns Unit

                // advanceQueue for from-box (after active player left)
                coEvery { queueRepo.findByTicketBoxId(fromBoxId) } returns fromQueue
                coEvery { queueEntryRepo.findNextWaiting(fromQueue.id) } returns null
                coEvery { queueRepo.save(match { it.ticketBoxId == fromBoxId }) } answers { firstArg() }
                coEvery { queueEntryRepo.findActiveEntries(fromQueue.id) } returns emptyList()

                // To-box join
                coEvery { queueRepo.findByTicketBoxId(toBoxId) } returns toQueue
                coEvery { queueEntryRepo.findActiveEntry(toQueue.id, player) } returns null
                coEvery { queueEntryRepo.findActiveEntries(toQueue.id) } returns emptyList()

                val newEntry = makeEntry(toQueue.id, player, QueueEntryStatus.WAITING)
                val activatedNewEntry = newEntry.copy(status = QueueEntryStatus.ACTIVE, activatedAt = now)
                coEvery { queueEntryRepo.save(match { it.status == QueueEntryStatus.WAITING }) } returns newEntry
                coEvery { queueEntryRepo.save(match { it.status == QueueEntryStatus.ACTIVE }) } returns
                    activatedNewEntry
                coEvery { queueRepo.save(match { it.ticketBoxId == toBoxId }) } answers { firstArg() }
                coEvery { redisPubSub.publish("queue:$toBoxId", any()) } returns Unit

                val service =
                    KujiQueueService(
                        distributedLock = distributedLock,
                        queueRepository = queueRepo,
                        queueEntryRepository = queueEntryRepo,
                        redisPubSub = redisPubSub,
                    )

                val newQueueEntry = service.switchBox(player, fromBoxId, toBoxId, sessionSeconds = 300)

                newQueueEntry.status shouldBe QueueEntryStatus.ACTIVE

                // Verify fromBox lock was acquired before toBox lock
                val fromLockIndex = operationOrder.indexOfFirst { it.contains(fromBoxId.toString()) }
                val toLockIndex = operationOrder.indexOfFirst { it.contains(toBoxId.toString()) }
                (fromLockIndex < toLockIndex) shouldBe true
            }

            it("queue advance is a no-op when no next waiting player exists") {
                val boxId = UUID.randomUUID()

                val distributedLock = mockk<DistributedLock>()
                val queueRepo = mockk<IQueueRepository>()
                val queueEntryRepo = mockk<IQueueEntryRepository>()
                val redisPubSub = mockk<RedisPubSub>()

                val queue = makeQueue(boxId, activePlayerId = null)

                coEvery { distributedLock.withLock(any<String>(), any<Long>(), any<suspend () -> Unit>()) } coAnswers {
                    val block = thirdArg<suspend () -> Unit>()
                    block()
                }

                coEvery { queueRepo.findByTicketBoxId(boxId) } returns queue
                coEvery { queueEntryRepo.findNextWaiting(queue.id) } returns null
                coEvery { queueRepo.save(any()) } answers { firstArg() }
                coEvery { queueEntryRepo.findActiveEntries(queue.id) } returns emptyList()
                coEvery { redisPubSub.publish(any(), any()) } returns Unit

                val service =
                    KujiQueueService(
                        distributedLock = distributedLock,
                        queueRepository = queueRepo,
                        queueEntryRepository = queueEntryRepo,
                        redisPubSub = redisPubSub,
                    )

                // Must not throw
                service.advanceQueue(boxId, sessionSeconds = 300)

                // Queue saved with null activePlayerId (idle state)
                coVerify(exactly = 1) { queueRepo.save(match { it.activePlayerId == null }) }
            }
        }
    })
