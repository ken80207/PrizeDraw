package com.prizedraw.concurrency

import com.prizedraw.application.ports.output.IDrawSyncRepository
import com.prizedraw.application.services.DrawResult
import com.prizedraw.application.services.DrawSyncService
import com.prizedraw.domain.entities.DrawSyncSession
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.datetime.Clock
import java.util.UUID

/**
 * Verifies the anti-spoiler guarantee and state transitions of [DrawSyncService].
 *
 * Key invariants:
 * - Result is NEVER broadcast in DRAW_STARTED or DRAW_PROGRESS events.
 * - DRAW_REVEALED is broadcast exactly once, only in [DrawSyncService.completeDraw].
 * - Cancelled sessions cannot be completed.
 * - Progress relay is a no-op for terminal sessions.
 */
class DrawSyncServiceTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makeSession(
            id: UUID = UUID.randomUUID(),
            campaignId: UUID = UUID.randomUUID(),
            isRevealed: Boolean = false,
            isCancelled: Boolean = false,
            resultGrade: String = "A",
            resultPrizeName: String = "A Prize",
            resultPhotoUrl: String? = "https://example.com/photo.jpg",
        ) = DrawSyncSession(
            id = id,
            ticketId = UUID.randomUUID(),
            campaignId = campaignId,
            playerId = UUID.randomUUID(),
            animationMode = "TEAR",
            resultGrade = resultGrade,
            resultPrizeName = resultPrizeName,
            resultPhotoUrl = resultPhotoUrl,
            resultPrizeInstanceId = UUID.randomUUID(),
            progress = 0f,
            isRevealed = isRevealed,
            isCancelled = isCancelled,
            startedAt = now,
            revealedAt = null,
            cancelledAt = null,
        )

        afterEach { clearAllMocks() }

        describe("startDraw") {
            it("DRAW_STARTED event does NOT include the result grade or prize name") {
                val drawSyncRepo = mockk<IDrawSyncRepository>()
                val redisPubSub = mockk<RedisPubSub>()
                val service = DrawSyncService(drawSyncRepo, redisPubSub)

                val campaignId = UUID.randomUUID()
                val result =
                    DrawResult(
                        grade = "A",
                        prizeName = "Secret Prize",
                        photoUrl = null,
                        prizeInstanceId = UUID.randomUUID(),
                    )
                val publishedPayload = slot<String>()

                coEvery { drawSyncRepo.save(any()) } answers { firstArg() }
                coEvery { redisPubSub.publish(any(), capture(publishedPayload)) } returns Unit

                service.startDraw(UUID.randomUUID(), UUID.randomUUID(), campaignId, "TEAR", result)

                publishedPayload.captured shouldContain "DRAW_STARTED"
                publishedPayload.captured shouldNotContain "Secret Prize"
                publishedPayload.captured shouldNotContain "\"grade\""
            }
        }

        describe("relayProgress") {
            it("publishes DRAW_PROGRESS with the correct progress value") {
                val drawSyncRepo = mockk<IDrawSyncRepository>()
                val redisPubSub = mockk<RedisPubSub>()
                val service = DrawSyncService(drawSyncRepo, redisPubSub)

                val session = makeSession()
                val publishedPayload = slot<String>()

                coEvery { drawSyncRepo.findById(session.id) } returns session
                coEvery { drawSyncRepo.updateProgress(session.id, 0.45f) } returns Unit
                coEvery { redisPubSub.publish(any(), capture(publishedPayload)) } returns Unit

                service.relayProgress(session.id, 0.45f)

                publishedPayload.captured shouldContain "DRAW_PROGRESS"
                publishedPayload.captured shouldContain "0.45"
                coVerify(exactly = 1) { drawSyncRepo.updateProgress(session.id, 0.45f) }
            }

            it("is a no-op when session is already revealed") {
                val drawSyncRepo = mockk<IDrawSyncRepository>()
                val redisPubSub = mockk<RedisPubSub>()
                val service = DrawSyncService(drawSyncRepo, redisPubSub)

                val revealedSession = makeSession(isRevealed = true)
                coEvery { drawSyncRepo.findById(revealedSession.id) } returns revealedSession

                service.relayProgress(revealedSession.id, 0.9f)

                coVerify(exactly = 0) { drawSyncRepo.updateProgress(any(), any()) }
                coVerify(exactly = 0) { redisPubSub.publish(any(), any()) }
            }

            it("is a no-op when session is cancelled") {
                val drawSyncRepo = mockk<IDrawSyncRepository>()
                val redisPubSub = mockk<RedisPubSub>()
                val service = DrawSyncService(drawSyncRepo, redisPubSub)

                val cancelledSession = makeSession(isCancelled = true)
                coEvery { drawSyncRepo.findById(cancelledSession.id) } returns cancelledSession

                service.relayProgress(cancelledSession.id, 0.5f)

                coVerify(exactly = 0) { drawSyncRepo.updateProgress(any(), any()) }
            }
        }

        describe("cancelDraw") {
            it("marks the session cancelled and broadcasts DRAW_CANCELLED") {
                val drawSyncRepo = mockk<IDrawSyncRepository>()
                val redisPubSub = mockk<RedisPubSub>()
                val service = DrawSyncService(drawSyncRepo, redisPubSub)

                val session = makeSession()
                val publishedPayload = slot<String>()

                coEvery { drawSyncRepo.findById(session.id) } returns session
                coEvery { drawSyncRepo.markCancelled(session.id) } returns Unit
                coEvery { redisPubSub.publish(any(), capture(publishedPayload)) } returns Unit

                service.cancelDraw(session.id)

                publishedPayload.captured shouldContain "DRAW_CANCELLED"
                coVerify(exactly = 1) { drawSyncRepo.markCancelled(session.id) }
            }

            it("does not cancel a session that is already revealed") {
                val drawSyncRepo = mockk<IDrawSyncRepository>()
                val redisPubSub = mockk<RedisPubSub>()
                val service = DrawSyncService(drawSyncRepo, redisPubSub)

                val revealedSession = makeSession(isRevealed = true)
                coEvery { drawSyncRepo.findById(revealedSession.id) } returns revealedSession

                service.cancelDraw(revealedSession.id)

                coVerify(exactly = 0) { drawSyncRepo.markCancelled(any()) }
                coVerify(exactly = 0) { redisPubSub.publish(any(), any()) }
            }
        }

        describe("completeDraw") {
            it("broadcasts DRAW_REVEALED with the hidden result after marking revealed") {
                val drawSyncRepo = mockk<IDrawSyncRepository>()
                val redisPubSub = mockk<RedisPubSub>()
                val service = DrawSyncService(drawSyncRepo, redisPubSub)

                val session = makeSession(resultGrade = "A", resultPrizeName = "Grand Prize")
                val publishedPayload = slot<String>()

                coEvery { drawSyncRepo.findById(session.id) } returns session
                coEvery { drawSyncRepo.markRevealed(session.id) } returns Unit
                coEvery { redisPubSub.publish(any(), capture(publishedPayload)) } returns Unit

                service.completeDraw(session.id)

                publishedPayload.captured shouldContain "DRAW_REVEALED"
                publishedPayload.captured shouldContain "Grand Prize"
                publishedPayload.captured shouldContain "\"grade\""
                coVerify(exactly = 1) { drawSyncRepo.markRevealed(session.id) }
            }

            it("throws IllegalStateException when session is cancelled") {
                val drawSyncRepo = mockk<IDrawSyncRepository>()
                val redisPubSub = mockk<RedisPubSub>()
                val service = DrawSyncService(drawSyncRepo, redisPubSub)

                val cancelledSession = makeSession(isCancelled = true)
                coEvery { drawSyncRepo.findById(cancelledSession.id) } returns cancelledSession

                shouldThrow<IllegalStateException> {
                    service.completeDraw(cancelledSession.id)
                }

                coVerify(exactly = 0) { drawSyncRepo.markRevealed(any()) }
                coVerify(exactly = 0) { redisPubSub.publish(any(), any()) }
            }

            it("throws IllegalStateException when session is not found") {
                val drawSyncRepo = mockk<IDrawSyncRepository>()
                val redisPubSub = mockk<RedisPubSub>()
                val service = DrawSyncService(drawSyncRepo, redisPubSub)

                val missingId = UUID.randomUUID()
                coEvery { drawSyncRepo.findById(missingId) } returns null

                shouldThrow<IllegalStateException> {
                    service.completeDraw(missingId)
                }
            }

            it("returns the session object on success") {
                val drawSyncRepo = mockk<IDrawSyncRepository>()
                val redisPubSub = mockk<RedisPubSub>()
                val service = DrawSyncService(drawSyncRepo, redisPubSub)

                val session = makeSession(resultGrade = "B")
                coEvery { drawSyncRepo.findById(session.id) } returns session
                coEvery { drawSyncRepo.markRevealed(session.id) } returns Unit
                coEvery { redisPubSub.publish(any(), any()) } returns Unit

                val returned = service.completeDraw(session.id)

                returned.id shouldBe session.id
                returned.resultGrade shouldBe "B"
            }
        }
    })
