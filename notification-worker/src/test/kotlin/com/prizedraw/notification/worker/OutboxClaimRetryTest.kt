package com.prizedraw.notification.worker

import com.prizedraw.domain.entities.OutboxEvent
import com.prizedraw.domain.entities.OutboxEventStatus
import com.prizedraw.notification.ports.IFollowRepository
import com.prizedraw.notification.ports.INotificationRepository
import com.prizedraw.notification.ports.INotificationService
import com.prizedraw.notification.ports.IOutboxRepository
import com.prizedraw.notification.ports.IPubSubService
import io.kotest.core.spec.style.FunSpec
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/**
 * Unit tests for [OutboxWorker] event processing and retry semantics.
 *
 * The underlying [IOutboxRepository] is mocked throughout; no database or
 * Redis connection is required.
 *
 * Test coverage:
 * - Successful dispatch marks the event PROCESSED via [IOutboxRepository.markProcessed].
 * - Dispatch failure with remaining attempts resets via [IOutboxRepository.markFailedOrRetry].
 * - Dispatch failure at max attempts delegates to [IOutboxRepository.markFailedOrRetry]
 *   with the exhausted attempt count.
 * - An empty claim result from [IOutboxRepository.claimPending] produces no downstream calls.
 */
class OutboxClaimRetryTest :
    FunSpec({

        val outboxRepository = mockk<IOutboxRepository>()
        val notificationService = mockk<INotificationService>()
        val pubSub = mockk<IPubSubService>()
        val notificationRepository = mockk<INotificationRepository>()
        val followRepository = mockk<IFollowRepository>()

        // Set up a fresh worker and clear mocks before each test to prevent state bleed.
        lateinit var worker: OutboxWorker

        beforeEach {
            clearAllMocks()
            worker =
                OutboxWorker(
                    outboxRepository = outboxRepository,
                    notificationService = notificationService,
                    pubSub = pubSub,
                    notificationRepository = notificationRepository,
                    followRepository = followRepository,
                )
            // Default stubs that most tests do not need to override.
            coEvery { notificationService.sendPush(any(), any()) } just runs
            coEvery { notificationService.sendPushBatch(any(), any()) } just runs
            coEvery { notificationRepository.save(any()) } returns mockk(relaxed = true)
            coEvery { notificationRepository.batchInsertIgnore(any()) } just runs
            coEvery { pubSub.publish(any(), any()) } just runs
            coEvery { outboxRepository.markProcessed(any()) } just runs
            coEvery { outboxRepository.markFailedOrRetry(any(), any(), any()) } just runs
        }

        fun makeEvent(
            eventType: String = "draw.completed",
            attempts: Int = 0,
            playerId: UUID = UUID.randomUUID(),
        ): OutboxEvent {
            val now = Clock.System.now()
            return OutboxEvent(
                id = UUID.randomUUID(),
                eventType = eventType,
                aggregateType = "DrawTicket",
                aggregateId = UUID.randomUUID(),
                payload = buildJsonObject { put("playerId", playerId.toString()) },
                status = OutboxEventStatus.IN_PROGRESS,
                attempts = attempts,
                processedAt = null,
                failureReason = null,
                createdAt = now,
            )
        }

        test("processEvent marks PROCESSED on success") {
            val event = makeEvent()
            coEvery { outboxRepository.claimPending(any()) } returns listOf(event)

            // Access the internal batch processor via the public start()/stop() path
            // is impractical in unit tests; instead we exercise the logic by calling
            // the private method indirectly through a single-item claimPending stub
            // combined with a cooperating dispatch chain.
            //
            // We invoke processBatch by calling start() is problematic (background loop),
            // so we validate the claim + dispatch chain via a direct repository protocol check.
            // The key invariant: if claimPending returns an event AND dispatch succeeds,
            // markProcessed must be called with that event's ID.

            coEvery { outboxRepository.claimPending(100) } returns listOf(event)

            // The worker is not started here; we verify the contract by invoking
            // an internal helper directly via a reflection-free white-box approach:
            // instantiate the worker, then use coroutine test infra to drive it.
            // Since OutboxWorker.processBatch is private, we call start() + stop()
            // and verify mock interactions within the single poll cycle.

            // The simplest approach: call the public API that triggers processBatch.
            // processBatch calls claimPending → dispatch → markProcessed.
            // We stub claimPending to return exactly one event, let dispatch succeed
            // (pubSub, notificationService stubs are in place), then verify markProcessed.

            // Delay would block forever in a normal loop, so we stop immediately after start.
            // The first iteration completes before stop() cancels the job.
            worker.start()
            kotlinx.coroutines.delay(200)
            worker.stop()

            coVerify(atLeast = 1) { outboxRepository.claimPending(any()) }
            coVerify(atLeast = 1) { outboxRepository.markProcessed(event.id) }
            coVerify(exactly = 0) { outboxRepository.markFailedOrRetry(any(), any(), any()) }
        }

        test("processEvent retries on failure when attempts below threshold") {
            val event = makeEvent(attempts = IOutboxRepository.MAX_ATTEMPTS - 2)
            coEvery { outboxRepository.claimPending(any()) } returns listOf(event)
            // Make pubSub.publish throw so dispatch() throws and the retry branch is taken.
            coEvery { pubSub.publish(any(), any()) } throws RuntimeException("Redis unavailable")

            worker.start()
            kotlinx.coroutines.delay(200)
            worker.stop()

            coVerify(atLeast = 1) {
                outboxRepository.markFailedOrRetry(
                    event.id,
                    any(),
                    event.attempts,
                )
            }
            coVerify(exactly = 0) { outboxRepository.markProcessed(any()) }
        }

        test("processEvent marks FAILED when max attempts exceeded") {
            // attempts == MAX_ATTEMPTS means the next markFailedOrRetry call should put the
            // event into FAILED state (the repository implementation handles the threshold check).
            val event = makeEvent(attempts = IOutboxRepository.MAX_ATTEMPTS)
            coEvery { outboxRepository.claimPending(any()) } returns listOf(event)
            coEvery { pubSub.publish(any(), any()) } throws RuntimeException("permanent failure")

            worker.start()
            kotlinx.coroutines.delay(200)
            worker.stop()

            // markFailedOrRetry is called with the exhausted attempt count; the repository
            // implementation decides to set FAILED because attempts >= MAX_ATTEMPTS.
            coVerify(atLeast = 1) {
                outboxRepository.markFailedOrRetry(
                    event.id,
                    any(),
                    IOutboxRepository.MAX_ATTEMPTS,
                )
            }
        }

        test("processBatch claims events not already in progress — empty claim produces no downstream calls") {
            // Simulates the multi-pod scenario: a second pod calls claimPending and receives
            // an empty list because the first pod already claimed all events via SKIP LOCKED.
            coEvery { outboxRepository.claimPending(any()) } returns emptyList()

            worker.start()
            kotlinx.coroutines.delay(200)
            worker.stop()

            coVerify(atLeast = 1) { outboxRepository.claimPending(any()) }
            // No events to process → no markProcessed or markFailedOrRetry calls.
            coVerify(exactly = 0) { outboxRepository.markProcessed(any()) }
            coVerify(exactly = 0) { outboxRepository.markFailedOrRetry(any(), any(), any()) }
        }

        test("processBatch processes all events in a claimed batch") {
            val events = (1..3).map { makeEvent() }
            coEvery { outboxRepository.claimPending(any()) } returns events

            worker.start()
            kotlinx.coroutines.delay(200)
            worker.stop()

            events.forEach { event ->
                coVerify(atLeast = 1) { outboxRepository.markProcessed(event.id) }
            }
        }
    })
