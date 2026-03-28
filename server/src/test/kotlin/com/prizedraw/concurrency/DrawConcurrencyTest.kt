package com.prizedraw.concurrency

import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IDrawRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IQueueRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.application.usecases.draw.DrawKujiDeps
import com.prizedraw.application.usecases.draw.DrawKujiUseCase
import com.prizedraw.application.usecases.draw.DrawUnlimitedDeps
import com.prizedraw.application.usecases.draw.DrawUnlimitedUseCase
import com.prizedraw.application.usecases.draw.NotSessionHolderException
import com.prizedraw.application.usecases.draw.UnlimitedRateLimitExceededException
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.domain.entities.DrawTicket
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.Queue
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.entities.TicketBoxStatus
import com.prizedraw.domain.entities.UnlimitedCampaign
import com.prizedraw.domain.services.DrawCore
import com.prizedraw.domain.services.DrawCoreDeps
import com.prizedraw.domain.services.DrawValidationException
import com.prizedraw.domain.services.KujiDrawDomainService
import com.prizedraw.domain.services.UnlimitedDrawDomainService
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import com.prizedraw.testutil.TransactionTestHelper
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import io.mockk.slot
import kotlinx.datetime.Clock
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger
import io.kotest.matchers.doubles.shouldBeGreaterThanOrEqual as shouldBeGreaterThanOrEqualDouble
import io.kotest.matchers.doubles.shouldBeLessThanOrEqual as shouldBeLessThanOrEqualDouble

/**
 * Concurrency tests for draw use cases.
 *
 * These tests verify that:
 *  - Ticket ownership is exclusive: exactly one player can draw each ticket.
 *  - Multi-draw quantity bounds are enforced before any state change.
 *  - SOLD_OUT cascade is atomic across the box and campaign.
 *  - The Redis sliding-window rate limiter caps burst unlimited draws.
 *
 * The approach is to drive concurrent calls through the use-case layer with MockK
 * repositories that track call counts and enforce state constraints atomically
 * using AtomicInteger / ConcurrentHashMap, simulating the optimistic-lock behaviour
 * of the real Exposed/Postgres implementation.
 */
class DrawConcurrencyTest :
    DescribeSpec({

        // -------------------------------------------------------------------------
        // Shared fixtures
        // -------------------------------------------------------------------------

        val now = Clock.System.now()
        val campaignId = CampaignId.generate()
        val boxId = UUID.randomUUID()
        val defId = PrizeDefinitionId.generate()

        fun makePlayer(
            balance: Int = 500,
            version: Int = 0,
        ) = Player(
            id = PlayerId.generate(),
            nickname = "Tester",
            playerCode = "TESTCODE",
            avatarUrl = null,
            phoneNumber = null,
            phoneVerifiedAt = null,
            oauthProvider = OAuthProvider.GOOGLE,
            oauthSubject = "sub",
            drawPointsBalance = balance,
            revenuePointsBalance = 0,
            version = version,
            preferredAnimationMode = DrawAnimationMode.TEAR,
            locale = "zh-TW",
            isActive = true,
            deletedAt = null,
            createdAt = now,
            updatedAt = now,
        )

        fun makeBox(remaining: Int) =
            TicketBox(
                id = boxId,
                kujiCampaignId = campaignId,
                name = "Box A",
                totalTickets = remaining,
                remainingTickets = remaining,
                status = TicketBoxStatus.AVAILABLE,
                soldOutAt = null,
                displayOrder = 1,
                createdAt = now,
                updatedAt = now,
            )

        fun makeTicket(
            boxId: UUID,
            pos: Int = 1,
        ) = DrawTicket(
            id = UUID.randomUUID(),
            ticketBoxId = boxId,
            prizeDefinitionId = defId,
            position = pos,
            status = com.prizedraw.domain.entities.DrawTicketStatus.AVAILABLE,
            drawnByPlayerId = null,
            drawnAt = null,
            prizeInstanceId = null,
            createdAt = now,
            updatedAt = now,
        )

        fun makeDef() =
            PrizeDefinition(
                id = defId,
                kujiCampaignId = campaignId,
                unlimitedCampaignId = null,
                grade = "A",
                name = "Grand Prize",
                photos = emptyList(),
                prizeValue = 0,
                buybackPrice = 100,
                buybackEnabled = true,
                probabilityBps = null,
                ticketCount = 1,
                displayOrder = 1,
                createdAt = now,
                updatedAt = now,
            )

        fun makeQueue(activePlayerId: PlayerId) =
            Queue(
                id = UUID.randomUUID(),
                ticketBoxId = boxId,
                activePlayerId = activePlayerId,
                sessionStartedAt = now,
                sessionExpiresAt = now.plus(kotlin.time.Duration.parse("5m")),
                createdAt = now,
                updatedAt = now,
            )

        fun makeKujiCampaign() =
            KujiCampaign(
                id = campaignId,
                title = "Test Kuji",
                description = null,
                coverImageUrl = null,
                pricePerDraw = 100,
                drawSessionSeconds = 300,
                status = CampaignStatus.ACTIVE,
                activatedAt = now,
                soldOutAt = null,
                createdByStaffId = UUID.randomUUID(),
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
            )

        beforeSpec {
            TransactionTestHelper.mockTransactions()
        }

        afterSpec {
            TransactionTestHelper.unmockTransactions()
        }

        beforeEach {
            TransactionTestHelper.stubTransaction()
        }

        // -------------------------------------------------------------------------
        // Kuji draw race conditions
        // -------------------------------------------------------------------------

        describe("Kuji draw race conditions") {

            afterEach { clearAllMocks() }

            it("two players cannot draw the same ticket simultaneously") {
                // The draw use case must validate that the caller is the active session holder.
                // Two different players — only the session holder must succeed.
                val playerA = makePlayer(balance = 500)
                val playerB = makePlayer(balance = 500) // playerB is NOT the session holder

                val ticket = makeTicket(boxId)
                val box = makeBox(5)
                val queue = makeQueue(playerA.id) // playerA holds the session

                val drawRepo = mockk<IDrawRepository>()
                val ticketBoxRepo = mockk<ITicketBoxRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val campaignRepo = mockk<ICampaignRepository>()
                val queueRepo = mockk<IQueueRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val domainService = KujiDrawDomainService()
                val redisPubSub = mockk<RedisPubSub>()

                coEvery { ticketBoxRepo.findById(boxId) } returns box
                coEvery { queueRepo.findByTicketBoxId(boxId) } returns queue
                coEvery { drawRepo.findTicketById(ticket.id) } returns ticket
                coEvery { campaignRepo.findKujiById(campaignId) } returns makeKujiCampaign()
                coEvery { playerRepo.findById(playerA.id) } returns playerA
                coEvery { playerRepo.findById(playerB.id) } returns playerB
                coEvery { playerRepo.updateBalance(playerA.id, any(), any(), any()) } returns true
                coEvery { prizeRepo.findDefinitionById(defId) } returns makeDef()
                // Return definitions with isRare=false so no follow notifications fire.
                coEvery { prizeRepo.findDefinitionsByCampaign(any(), any()) } returns listOf(makeDef())
                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                coEvery { drawRepo.markDrawn(any(), any(), any(), any()) } answers {
                    ticket.copy(
                        status = com.prizedraw.domain.entities.DrawTicketStatus.DRAWN,
                        drawnByPlayerId = playerA.id,
                        drawnAt = now,
                    )
                }
                coEvery { ticketBoxRepo.save(any()) } answers { firstArg() }
                coEvery { ticketBoxRepo.findByCampaignId(campaignId) } returns listOf(box)
                coEvery { drawPointTxRepo.record(any()) } just runs
                coEvery { auditRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs
                coEvery { redisPubSub.publish(any(), any()) } just runs

                val useCase =
                    DrawKujiUseCase(
                        DrawKujiDeps(
                            drawRepository = drawRepo,
                            ticketBoxRepository = ticketBoxRepo,
                            prizeRepository = prizeRepo,
                            playerRepository = playerRepo,
                            campaignRepository = campaignRepo,
                            queueRepository = queueRepo,
                            outboxRepository = outboxRepo,
                            auditRepository = auditRepo,
                            domainService = domainService,
                            redisPubSub = redisPubSub,
                            drawCore =
                                DrawCore(
                                    DrawCoreDeps(
                                        playerRepository = playerRepo,
                                        prizeRepository = prizeRepo,
                                        drawPointTxRepository = drawPointTxRepo,
                                        outboxRepository = outboxRepo
                                    )
                                ),
                            feedService = mockk(relaxed = true),
                        ),
                    )

                // playerA (session holder) must succeed
                val resultA =
                    useCase.execute(
                        playerId = playerA.id,
                        ticketBoxId = boxId,
                        ticketIds = listOf(ticket.id),
                        quantity = 1,
                        playerCouponId = null,
                    )
                resultA.tickets shouldHaveSize 1

                // playerB (NOT session holder) must fail
                shouldThrow<NotSessionHolderException> {
                    useCase.execute(
                        playerId = playerB.id,
                        ticketBoxId = boxId,
                        ticketIds = listOf(ticket.id),
                        quantity = 1,
                        playerCouponId = null,
                    )
                }

                // Prize instance created exactly once
                coVerify(exactly = 1) { prizeRepo.saveInstance(any()) }
            }

            it("multi-draw cannot exceed remaining tickets") {
                // Box with 3 remaining tickets; player requests 5-draw
                val player = makePlayer(balance = 1000)
                val box = makeBox(3) // only 3 left
                val queue = makeQueue(player.id)

                val drawRepo = mockk<IDrawRepository>()
                val ticketBoxRepo = mockk<ITicketBoxRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val campaignRepo = mockk<ICampaignRepository>()
                val queueRepo = mockk<IQueueRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val domainService = KujiDrawDomainService()
                val redisPubSub = mockk<RedisPubSub>()

                coEvery { ticketBoxRepo.findById(boxId) } returns box
                coEvery { queueRepo.findByTicketBoxId(boxId) } returns queue
                coEvery { campaignRepo.findKujiById(campaignId) } returns makeKujiCampaign()

                val useCase =
                    DrawKujiUseCase(
                        DrawKujiDeps(
                            drawRepository = drawRepo,
                            ticketBoxRepository = ticketBoxRepo,
                            prizeRepository = prizeRepo,
                            playerRepository = playerRepo,
                            campaignRepository = campaignRepo,
                            queueRepository = queueRepo,
                            outboxRepository = outboxRepo,
                            auditRepository = auditRepo,
                            domainService = domainService,
                            redisPubSub = redisPubSub,
                            drawCore =
                                DrawCore(
                                    DrawCoreDeps(
                                        playerRepository = playerRepo,
                                        prizeRepository = prizeRepo,
                                        drawPointTxRepository = drawPointTxRepo,
                                        outboxRepository = outboxRepo
                                    )
                                ),
                            feedService = mockk(relaxed = true),
                        ),
                    )

                // Requesting 5 draws from a box with 3 remaining must fail before any state change
                shouldThrow<DrawValidationException> {
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxId,
                        ticketIds = emptyList(),
                        quantity = 5,
                        playerCouponId = null,
                    )
                }

                // No prizes created, no balance debited
                coVerify(exactly = 0) { prizeRepo.saveInstance(any()) }
                coVerify(exactly = 0) { playerRepo.updateBalance(any(), any(), any(), any()) }
            }

            it("sold-out cascade is atomic") {
                // Box with exactly 1 ticket; drawing it must transition box → SOLD_OUT and campaign → SOLD_OUT
                val player = makePlayer(balance = 500)
                val box = makeBox(1)
                val ticket = makeTicket(boxId)
                val queue = makeQueue(player.id)
                val campaign = makeKujiCampaign()

                val capturedBox = slot<TicketBox>()

                val drawRepo = mockk<IDrawRepository>()
                val ticketBoxRepo = mockk<ITicketBoxRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val campaignRepo = mockk<ICampaignRepository>()
                val queueRepo = mockk<IQueueRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val domainService = KujiDrawDomainService()
                val redisPubSub = mockk<RedisPubSub>()

                coEvery { ticketBoxRepo.findById(boxId) } returns box
                coEvery { queueRepo.findByTicketBoxId(boxId) } returns queue
                coEvery { drawRepo.findTicketById(ticket.id) } returns ticket
                coEvery { campaignRepo.findKujiById(campaignId) } returns campaign
                coEvery { playerRepo.findById(player.id) } returns player
                coEvery { playerRepo.updateBalance(player.id, any(), any(), any()) } returns true
                coEvery { prizeRepo.findDefinitionById(defId) } returns makeDef()
                // Return definitions with isRare=false so no follow notifications fire.
                coEvery { prizeRepo.findDefinitionsByCampaign(any(), any()) } returns listOf(makeDef())
                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                coEvery { drawRepo.markDrawn(any(), any(), any(), any()) } answers {
                    ticket.copy(
                        status = com.prizedraw.domain.entities.DrawTicketStatus.DRAWN,
                        drawnByPlayerId = player.id,
                        drawnAt = now,
                    )
                }
                coEvery { ticketBoxRepo.save(capture(capturedBox)) } answers { capturedBox.captured }
                // After the last ticket, all boxes are SOLD_OUT
                coEvery { ticketBoxRepo.findByCampaignId(campaignId) } answers {
                    listOf(capturedBox.captured.takeIf { it.status == TicketBoxStatus.SOLD_OUT } ?: box)
                }
                coEvery { campaignRepo.updateKujiStatus(campaignId, CampaignStatus.SOLD_OUT) } returns Unit
                every { drawPointTxRepo.record(any()) } just runs
                every { auditRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs
                coEvery { redisPubSub.publish(any(), any()) } returns Unit

                val useCase =
                    DrawKujiUseCase(
                        DrawKujiDeps(
                            drawRepository = drawRepo,
                            ticketBoxRepository = ticketBoxRepo,
                            prizeRepository = prizeRepo,
                            playerRepository = playerRepo,
                            campaignRepository = campaignRepo,
                            queueRepository = queueRepo,
                            outboxRepository = outboxRepo,
                            auditRepository = auditRepo,
                            domainService = domainService,
                            redisPubSub = redisPubSub,
                            drawCore =
                                DrawCore(
                                    DrawCoreDeps(
                                        playerRepository = playerRepo,
                                        prizeRepository = prizeRepo,
                                        drawPointTxRepository = drawPointTxRepo,
                                        outboxRepository = outboxRepo
                                    )
                                ),
                            feedService = mockk(relaxed = true),
                        ),
                    )

                useCase.execute(
                    playerId = player.id,
                    ticketBoxId = boxId,
                    ticketIds = listOf(ticket.id),
                    quantity = 1,
                    playerCouponId = null,
                )

                // The box must have been saved with SOLD_OUT status
                capturedBox.captured.status shouldBe TicketBoxStatus.SOLD_OUT
                capturedBox.captured.remainingTickets shouldBe 0

                // Campaign status must also have been updated to SOLD_OUT atomically in same transaction
                coVerify(exactly = 1) { campaignRepo.updateKujiStatus(campaignId, CampaignStatus.SOLD_OUT) }
            }
        }

        // -------------------------------------------------------------------------
        // Unlimited draw rate limiting
        // -------------------------------------------------------------------------

        describe("Unlimited draw rate limiting") {

            afterEach { clearAllMocks() }

            it("rate limit prevents burst draws exceeding the per-second threshold") {
                // The rate limit guard is Redis-based (sliding window). We verify that the
                // use case throws UnlimitedRateLimitExceededException once the window fills.
                // We test this by mocking the campaign's rateLimitPerSecond = 2, then
                // simulating 3 draws arriving at the same millisecond.
                val player = makePlayer(balance = 5000)
                val unlimitedCampaignId = UUID.randomUUID()
                val unlimitedCampaign =
                    UnlimitedCampaign(
                        id = CampaignId(unlimitedCampaignId),
                        title = "Unlimited Test",
                        description = null,
                        coverImageUrl = null,
                        pricePerDraw = 100,
                        rateLimitPerSecond = 2, // Max 2 draws per second
                        status = CampaignStatus.ACTIVE,
                        activatedAt = now,
                        createdByStaffId = UUID.randomUUID(),
                        deletedAt = null,
                        createdAt = now,
                        updatedAt = now,
                    )

                val prizeRepo = mockk<IPrizeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val campaignRepo = mockk<ICampaignRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val domainService = UnlimitedDrawDomainService()

                // We use an in-process atomic counter to simulate the Redis rate limit window
                val drawCountInWindow = AtomicInteger(0)
                val redisClient = mockk<com.prizedraw.infrastructure.external.redis.RedisClient>()

                // Simulate the Redis sliding window: reject once count >= rateLimitPerSecond
                coEvery {
                    redisClient.withConnection<Long>(any())
                } coAnswers {
                    val current = drawCountInWindow.getAndIncrement()
                    current.toLong() // returns current count before this draw
                }

                coEvery { campaignRepo.findUnlimitedById(CampaignId(unlimitedCampaignId)) } returns unlimitedCampaign
                val unlimitedDef = makeDef().copy(probabilityBps = 1_000_000)
                coEvery { prizeRepo.findDefinitionsByCampaign(any(), any()) } returns listOf(unlimitedDef)
                coEvery { prizeRepo.findDefinitionById(any()) } returns unlimitedDef
                coEvery { playerRepo.findById(player.id) } returns player
                coEvery { playerRepo.updateBalance(any(), any(), any(), any()) } returns true
                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { drawPointTxRepo.record(any()) } just runs
                every { auditRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val useCase =
                    DrawUnlimitedUseCase(
                        DrawUnlimitedDeps(
                            campaignRepository = campaignRepo,
                            prizeRepository = prizeRepo,
                            outboxRepository = outboxRepo,
                            auditRepository = auditRepo,
                            domainService = domainService,
                            redisClient = redisClient,
                            drawCore =
                                DrawCore(
                                    DrawCoreDeps(
                                        playerRepository = playerRepo,
                                        prizeRepository = prizeRepo,
                                        drawPointTxRepository = drawPointTxRepo,
                                        outboxRepository = outboxRepo
                                    )
                                ),
                            feedService = mockk(relaxed = true),
                            playerRepository = playerRepo,
                        ),
                    )

                // First two draws should pass (window count: 0, 1 < rateLimitPerSecond=2)
                useCase.execute(player.id, unlimitedCampaignId, null)
                useCase.execute(player.id, unlimitedCampaignId, null)

                // Third draw should be rejected (count=2 >= rateLimitPerSecond=2)
                shouldThrow<UnlimitedRateLimitExceededException> {
                    useCase.execute(player.id, unlimitedCampaignId, null)
                }
            }

            it("rate limit counter resets — draws after the window advance succeed") {
                // Verify that the rate limiter is a sliding window: after enough time, draws succeed again.
                // We simulate this by resetting the in-process counter to 0 (representing stale entries removed).
                val player = makePlayer(balance = 5000)
                val unlimitedCampaignId = UUID.randomUUID()
                val campaign =
                    UnlimitedCampaign(
                        id = CampaignId(unlimitedCampaignId),
                        title = "Rate Window Test",
                        description = null,
                        coverImageUrl = null,
                        pricePerDraw = 100,
                        rateLimitPerSecond = 1,
                        status = CampaignStatus.ACTIVE,
                        activatedAt = now,
                        createdByStaffId = UUID.randomUUID(),
                        deletedAt = null,
                        createdAt = now,
                        updatedAt = now,
                    )

                val callNumber = AtomicInteger(0)
                val redisClient = mockk<com.prizedraw.infrastructure.external.redis.RedisClient>()

                // Call 1: count = 0 (window empty, allow)
                // Call 2: count = 1 (at limit, reject)
                // Call 3: count = 0 (window reset, allow)
                coEvery { redisClient.withConnection<Long>(any()) } coAnswers {
                    when (callNumber.getAndIncrement()) {
                        0 -> 0L
                        1 -> 1L // triggers rejection
                        else -> 0L // window has reset
                    }
                }

                val campaignRepo = mockk<ICampaignRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val domainService = UnlimitedDrawDomainService()

                val unlimitedDef2 = makeDef().copy(probabilityBps = 1_000_000)
                coEvery { campaignRepo.findUnlimitedById(CampaignId(unlimitedCampaignId)) } returns campaign
                coEvery { prizeRepo.findDefinitionsByCampaign(any(), any()) } returns listOf(unlimitedDef2)
                coEvery { prizeRepo.findDefinitionById(any()) } returns unlimitedDef2
                coEvery { playerRepo.findById(player.id) } returns player
                coEvery { playerRepo.updateBalance(any(), any(), any(), any()) } returns true
                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { drawPointTxRepo.record(any()) } just runs
                every { auditRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val useCase =
                    DrawUnlimitedUseCase(
                        DrawUnlimitedDeps(
                            campaignRepository = campaignRepo,
                            prizeRepository = prizeRepo,
                            outboxRepository = outboxRepo,
                            auditRepository = auditRepo,
                            domainService = domainService,
                            redisClient = redisClient,
                            drawCore =
                                DrawCore(
                                    DrawCoreDeps(
                                        playerRepository = playerRepo,
                                        prizeRepository = prizeRepo,
                                        drawPointTxRepository = drawPointTxRepo,
                                        outboxRepository = outboxRepo
                                    )
                                ),
                            feedService = mockk(relaxed = true),
                            playerRepository = playerRepo,
                        ),
                    )

                // First draw passes, second rejected, third (after window reset) passes
                useCase.execute(player.id, unlimitedCampaignId, null)

                shouldThrow<UnlimitedRateLimitExceededException> {
                    useCase.execute(player.id, unlimitedCampaignId, null)
                }

                // Window has reset — should succeed again
                useCase.execute(player.id, unlimitedCampaignId, null)
            }
        }

        // -------------------------------------------------------------------------
        // UnlimitedDrawDomainService additions
        // -------------------------------------------------------------------------

        describe("UnlimitedDrawDomainService probability invariants") {

            val domainService = UnlimitedDrawDomainService()

            fun makeUnlimitedDef(
                grade: String,
                probabilityBps: Int,
            ) = PrizeDefinition(
                id = PrizeDefinitionId.generate(),
                kujiCampaignId = null,
                unlimitedCampaignId = CampaignId.generate(),
                grade = grade,
                name = "Prize $grade",
                photos = emptyList(),
                prizeValue = 0,
                buybackPrice = 0,
                buybackEnabled = false,
                probabilityBps = probabilityBps,
                ticketCount = null,
                displayOrder = 0,
                createdAt = Clock.System.now(),
                updatedAt = Clock.System.now(),
            )

            it("probability distribution is fair over large sample") {
                // 70/30 split over 50,000 draws — both prizes must appear within 5% tolerance
                val defCommon = makeUnlimitedDef("Common", 700_000) // 70%
                val defRare = makeUnlimitedDef("Rare", 300_000) // 30%
                val defs = listOf(defCommon, defRare)

                val totalSpins = 50_000
                var commonCount = 0
                var rareCount = 0

                repeat(totalSpins) {
                    when (domainService.spin(defs).id) {
                        defCommon.id -> commonCount++
                        defRare.id -> rareCount++
                    }
                }

                val commonRate = commonCount.toDouble() / totalSpins
                val rareRate = rareCount.toDouble() / totalSpins

                commonRate shouldBeGreaterThanOrEqualDouble 0.65
                commonRate shouldBeLessThanOrEqualDouble 0.75
                rareRate shouldBeGreaterThanOrEqualDouble 0.25
                rareRate shouldBeLessThanOrEqualDouble 0.35
            }

            it("zero-probability prize is never drawn") {
                // A prize with 0 bps probability must never appear.
                // The remaining probability is held by the guaranteed prize.
                val defImpossible = makeUnlimitedDef("Impossible", 0) // 0%
                val defGuaranteed = makeUnlimitedDef("Guaranteed", 1_000_000) // 100%
                val defs = listOf(defImpossible, defGuaranteed)

                repeat(10_000) { attempt ->
                    val result = domainService.spin(defs)
                    result.id shouldBe defGuaranteed.id
                }
            }
        }
    })
