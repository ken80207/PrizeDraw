package com.prizedraw.inventory

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
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.domain.entities.DrawTicket
import com.prizedraw.domain.entities.DrawTicketStatus
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.Queue
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.entities.TicketBoxStatus
import com.prizedraw.application.services.FeedService
import com.prizedraw.domain.services.DrawCore
import com.prizedraw.domain.services.DrawCoreDeps
import com.prizedraw.domain.services.KujiDrawDomainService
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import com.prizedraw.testutil.TransactionTestHelper
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.ints.shouldBeGreaterThanOrEqual
import io.kotest.matchers.ints.shouldBeLessThanOrEqual
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.datetime.Clock
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger
import com.prizedraw.domain.services.DrawValidationException as DomainDrawValidationException

/**
 * Comprehensive inventory-integrity tests for the kuji draw use case.
 *
 * These tests verify that the six core invariants are never violated:
 * 1. Total tickets drawn NEVER exceeds (boxes * ticketsPerBox).
 * 2. Per-box drawn count NEVER exceeds [TicketBox.totalTickets].
 * 3. Per-grade drawn count NEVER exceeds the configured allocation.
 * 4. Full draw-out yields exact prize distribution — no duplicates, no missing.
 * 5. No ticket is drawn twice.
 * 6. After a box is sold out, further draws are rejected without mutating state.
 * 7. After all boxes are sold out, campaign status transitions to SOLD_OUT.
 *
 * All repository interactions are replaced by atomic in-memory fakes that mirror
 * the optimistic-concurrency behaviour of the real Postgres implementation.
 */
class TicketInventoryIntegrityTest :
    DescribeSpec({

        // -------------------------------------------------------------------------
        // Shared test-clock and base timestamps
        // -------------------------------------------------------------------------

        val now = Clock.System.now()
        val sessionExpiry = now.plus(kotlin.time.Duration.parse("5m"))

        // -------------------------------------------------------------------------
        // Domain fixture helpers
        // -------------------------------------------------------------------------

        fun makePlayer(balance: Int = 10_000): Player =
            Player(
                id = PlayerId.generate(),
                nickname = "Tester",
                avatarUrl = null,
                phoneNumber = null,
                phoneVerifiedAt = null,
                oauthProvider = OAuthProvider.GOOGLE,
                oauthSubject = "sub-${UUID.randomUUID()}",
                drawPointsBalance = balance,
                revenuePointsBalance = 0,
                version = 0,
                preferredAnimationMode = DrawAnimationMode.TEAR,
                locale = "zh-TW",
                isActive = true,
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
            )

        fun makeCampaign(id: CampaignId = CampaignId.generate()): KujiCampaign =
            KujiCampaign(
                id = id,
                title = "Test Kuji",
                description = null,
                coverImageUrl = null,
                pricePerDraw = 1,
                drawSessionSeconds = 300,
                status = CampaignStatus.ACTIVE,
                activatedAt = now,
                soldOutAt = null,
                createdByStaffId = UUID.randomUUID(),
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
            )

        fun makeBox(
            id: UUID = UUID.randomUUID(),
            campaignId: CampaignId,
            total: Int,
            remaining: Int = total,
            status: TicketBoxStatus = TicketBoxStatus.AVAILABLE,
            displayOrder: Int = 1,
        ): TicketBox =
            TicketBox(
                id = id,
                kujiCampaignId = campaignId,
                name = "Box",
                totalTickets = total,
                remainingTickets = remaining,
                status = status,
                soldOutAt = null,
                displayOrder = displayOrder,
                createdAt = now,
                updatedAt = now,
            )

        fun makeQueue(
            boxId: UUID,
            activePlayerId: PlayerId,
        ): Queue =
            Queue(
                id = UUID.randomUUID(),
                ticketBoxId = boxId,
                activePlayerId = activePlayerId,
                sessionStartedAt = now,
                sessionExpiresAt = sessionExpiry,
                createdAt = now,
                updatedAt = now,
            )

        /**
         * Creates a [PrizeDefinition] for a kuji campaign.
         *
         * @param campaignId Parent campaign.
         * @param grade Grade label (e.g. "A", "B").
         * @param ticketCount Allocated ticket count for this grade.
         */
        fun makeDef(
            campaignId: CampaignId,
            grade: String,
            ticketCount: Int,
        ): PrizeDefinition =
            PrizeDefinition(
                id = PrizeDefinitionId.generate(),
                kujiCampaignId = campaignId,
                unlimitedCampaignId = null,
                grade = grade,
                name = "Prize $grade",
                photos = emptyList(),
                prizeValue = 0,
                buybackPrice = 0,
                buybackEnabled = false,
                probabilityBps = null,
                ticketCount = ticketCount,
                displayOrder = 0,
                createdAt = now,
                updatedAt = now,
            )

        /**
         * Builds a flat ordered list of [DrawTicket]s for a single box according to the
         * grade-to-count distribution supplied in [gradeCounts].
         *
         * For example, `gradeCounts = mapOf("A" to 1, "B" to 2, "C" to 3, "D" to 4)`
         * produces 10 tickets with positions 1–10.
         */
        fun buildTickets(
            boxId: UUID,
            defs: Map<String, PrizeDefinition>,
            gradeCounts: Map<String, Int>,
        ): List<DrawTicket> {
            val tickets = mutableListOf<DrawTicket>()
            var pos = 1
            for ((grade, count) in gradeCounts) {
                val def = requireNotNull(defs[grade]) { "No definition for grade $grade" }
                repeat(count) {
                    tickets.add(
                        DrawTicket(
                            id = UUID.randomUUID(),
                            ticketBoxId = boxId,
                            prizeDefinitionId = def.id,
                            position = pos++,
                            status = DrawTicketStatus.AVAILABLE,
                            drawnByPlayerId = null,
                            drawnAt = null,
                            prizeInstanceId = null,
                            createdAt = now,
                            updatedAt = now,
                        ),
                    )
                }
            }
            return tickets
        }

        // -------------------------------------------------------------------------
        // In-memory atomic fake repository factory
        //
        // The fake enforces the same optimistic-concurrency guarantees as the real
        // Postgres implementation:
        //  - markDrawn  rejects if the ticket is already DRAWN (returns the existing drawn state)
        //  - decrementRemainingTickets uses AtomicReference to CAS remaining count
        //  - drawnTicketIds tracks every ticket that has been committed as drawn
        //
        // Each test creates a fresh set of fakes via this factory so tests are fully
        // isolated with no shared mutable state.
        // -------------------------------------------------------------------------

        /**
         * Bundles all the repository mocks and their shared in-memory state for one test scenario.
         *
         * @property drawRepo           Fake [IDrawRepository] backed by [drawnTicketIds].
         * @property ticketBoxRepo      Fake [ITicketBoxRepository] backed by [boxStateRef].
         * @property drawnTicketIds     Set of ticket IDs committed as DRAWN; ConcurrentHashMap
         *                              acting as a concurrent set for racy draw tests.
         * @property boxStateRef        AtomicReference holding current [TicketBox] snapshots
         *                              keyed by box ID, reflecting remaining count mutations.
         * @property savedBoxStates     Ordered list of all box snapshots passed to [ITicketBoxRepository.save].
         * @property campaignSoldOutCalled  True once [ICampaignRepository.updateKujiStatus] is called
         *                              with [CampaignStatus.SOLD_OUT].
         * @property prizeRepo          Relaxed mock recording saved [com.prizedraw.domain.entities.PrizeInstance]s.
         * @property savedInstances     All [PrizeInstanceId] values saved during the test.
         */
        data class FakeRepos(
            val drawRepo: IDrawRepository,
            val ticketBoxRepo: ITicketBoxRepository,
            val prizeRepo: IPrizeRepository,
            val playerRepo: IPlayerRepository,
            val campaignRepo: ICampaignRepository,
            val queueRepo: IQueueRepository,
            val drawPointTxRepo: IDrawPointTransactionRepository,
            val outboxRepo: IOutboxRepository,
            val auditRepo: IAuditRepository,
            val redisPubSub: RedisPubSub,
            val drawnTicketIds: ConcurrentHashMap<UUID, UUID>, // ticketId → prizeInstanceId
            val boxStateRef: ConcurrentHashMap<UUID, AtomicInteger>, // boxId → remaining
            val soldOutBoxIds: ConcurrentHashMap<UUID, Boolean>, // boxId → isSoldOut
            val campaignSoldOutCalled: AtomicInteger, // count of SOLD_OUT status updates
            val savedInstanceGrades: ConcurrentHashMap<UUID, String>, // prizeInstanceId → grade
        )

        /**
         * Builds a complete set of fakes for a multi-box scenario.
         *
         * @param campaign The kuji campaign being tested.
         * @param boxTicketMap  Map of boxId → list of tickets in that box.
         * @param defsByGrade   Map of grade → [PrizeDefinition] (campaign-wide).
         * @param player The active session player.
         */
        fun buildFakes(
            campaign: KujiCampaign,
            boxTicketMap: Map<UUID, List<DrawTicket>>,
            defsByGrade: Map<String, PrizeDefinition>,
            player: Player,
            allBoxes: List<TicketBox>,
        ): FakeRepos {
            // Flat index: ticketId → DrawTicket
            val ticketIndex =
                boxTicketMap.values
                    .flatten()
                    .associateBy { it.id }
                    .toMutableMap()

            val drawnTicketIds = ConcurrentHashMap<UUID, UUID>()
            val boxStateRef = ConcurrentHashMap<UUID, AtomicInteger>()
            val soldOutBoxIds = ConcurrentHashMap<UUID, Boolean>()
            val campaignSoldOutCalled = AtomicInteger(0)
            val savedInstanceGrades = ConcurrentHashMap<UUID, String>()

            // Initialise remaining-count atomics per box
            for (box in allBoxes) {
                boxStateRef[box.id] = AtomicInteger(box.remainingTickets)
            }

            val drawRepo = mockk<IDrawRepository>()
            val ticketBoxRepo = mockk<ITicketBoxRepository>()
            val prizeRepo = mockk<IPrizeRepository>()
            val playerRepo = mockk<IPlayerRepository>()
            val campaignRepo = mockk<ICampaignRepository>()
            val queueRepo = mockk<IQueueRepository>()
            val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
            val outboxRepo = mockk<IOutboxRepository>()
            val auditRepo = mockk<IAuditRepository>()
            val redisPubSub = mockk<RedisPubSub>()

            // --- drawRepo stubs ---

            // findTicketById: always reflects current drawn state
            coEvery { drawRepo.findTicketById(any()) } coAnswers {
                val id = firstArg<UUID>()
                ticketIndex[id]
            }

            // findAvailableTickets: returns only AVAILABLE tickets for the box
            coEvery { drawRepo.findAvailableTickets(any()) } coAnswers {
                val boxId = firstArg<UUID>()
                ticketIndex.values.filter { it.ticketBoxId == boxId && it.status == DrawTicketStatus.AVAILABLE }
            }

            // findTicketsByBox: all tickets regardless of status
            coEvery { drawRepo.findTicketsByBox(any()) } coAnswers {
                val boxId = firstArg<UUID>()
                ticketIndex.values.filter { it.ticketBoxId == boxId }
            }

            // markDrawn: atomically transitions a ticket AVAILABLE → DRAWN; rejects double-draw
            // NOTE: PlayerId and PrizeInstanceId are @JvmInline value classes; at JVM bytecode level
            // they are unboxed to their underlying UUID type.  MockK's firstArg<T>()/secondArg<T>()
            // perform a direct cast that fails for value classes.  We use args[n] with explicit
            // UUID casts and re-wrap them into the value-class types ourselves.
            coEvery { drawRepo.markDrawn(any(), any(), any(), any()) } coAnswers {
                val ticketId = firstArg<UUID>()
                val drawingPlayer = PlayerId(args[1] as UUID)
                val instanceId = PrizeInstanceId(args[2] as UUID)

                // ConcurrentHashMap.putIfAbsent is the atomic gate — only one caller wins per ticketId
                val previous = drawnTicketIds.putIfAbsent(ticketId, instanceId.value)
                if (previous != null) {
                    // Already drawn — throw as the real DB would with a unique-constraint violation
                    throw DomainDrawValidationException("Ticket $ticketId has already been drawn")
                }

                // Mutate the in-memory ticket to DRAWN so subsequent findTicketById / findAvailableTickets
                // callers observe the updated state.
                val original =
                    ticketIndex[ticketId]
                        ?: throw IllegalArgumentException("Unknown ticket $ticketId")
                val drawn =
                    original.copy(
                        status = DrawTicketStatus.DRAWN,
                        drawnByPlayerId = drawingPlayer,
                        drawnAt = now,
                        prizeInstanceId = instanceId,
                    )
                ticketIndex[ticketId] = drawn

                // Record grade for distribution verification
                val def = defsByGrade.values.find { it.id == original.prizeDefinitionId }
                if (def != null) {
                    savedInstanceGrades[instanceId.value] = def.grade
                }

                drawn
            }

            // --- ticketBoxRepo stubs ---

            coEvery { ticketBoxRepo.findById(any()) } coAnswers {
                val boxId = firstArg<UUID>()
                val base = allBoxes.find { it.id == boxId } ?: return@coAnswers null
                val remaining = boxStateRef[boxId]?.get() ?: base.remainingTickets
                val isSoldOut = soldOutBoxIds.containsKey(boxId)
                base.copy(
                    remainingTickets = remaining,
                    status = if (isSoldOut) TicketBoxStatus.SOLD_OUT else TicketBoxStatus.AVAILABLE,
                )
            }

            coEvery { ticketBoxRepo.findByCampaignId(any()) } coAnswers {
                allBoxes.map { box ->
                    val remaining = boxStateRef[box.id]?.get() ?: box.remainingTickets
                    val isSoldOut = soldOutBoxIds.containsKey(box.id)
                    box.copy(
                        remainingTickets = remaining,
                        status = if (isSoldOut) TicketBoxStatus.SOLD_OUT else TicketBoxStatus.AVAILABLE,
                    )
                }
            }

            coEvery { ticketBoxRepo.save(any()) } coAnswers {
                val saved = firstArg<TicketBox>()
                // Track remaining count
                boxStateRef[saved.id]?.set(saved.remainingTickets)
                if (saved.status == TicketBoxStatus.SOLD_OUT) {
                    soldOutBoxIds[saved.id] = true
                }
                saved
            }

            coEvery { ticketBoxRepo.decrementRemainingTickets(any(), any()) } coAnswers {
                val boxId = firstArg<UUID>()
                val expected = secondArg<Int>()
                val atomicRef = boxStateRef[boxId] ?: return@coAnswers false
                atomicRef.compareAndSet(expected, expected - 1)
            }

            // --- prizeRepo stubs ---

            // PrizeDefinitionId is an @JvmInline value class — unboxed to UUID at JVM level.
            // Extract the raw UUID via args[0] and re-wrap before looking up in the index.
            coEvery { prizeRepo.findDefinitionById(any()) } coAnswers {
                val rawUuid = args[0] as UUID
                val defId = PrizeDefinitionId(rawUuid)
                defsByGrade.values.find { it.id == defId }
            }

            coEvery { prizeRepo.saveInstance(any()) } coAnswers {
                val instance = firstArg<com.prizedraw.domain.entities.PrizeInstance>()
                instance
            }

            // --- playerRepo stubs ---

            coEvery { playerRepo.findById(any()) } returns player
            coEvery { playerRepo.updateBalance(any(), any(), any(), any()) } returns true

            // --- campaignRepo stubs ---

            coEvery { campaignRepo.findKujiById(any()) } returns campaign

            // Register the general stub FIRST (lower priority in MockK's LIFO order),
            // then the specific SOLD_OUT stub LAST so it takes precedence.
            coEvery { campaignRepo.updateKujiStatus(any(), any()) } returns Unit

            coEvery { campaignRepo.updateKujiStatus(any(), CampaignStatus.SOLD_OUT) } coAnswers {
                campaignSoldOutCalled.incrementAndGet()
                Unit
            }

            // --- queueRepo stubs (each box gets its own queue pointing at the test player) ---

            coEvery { queueRepo.findByTicketBoxId(any()) } coAnswers {
                val boxId = firstArg<UUID>()
                makeQueue(boxId, player.id)
            }

            // --- fire-and-forget stubs ---

            every { drawPointTxRepo.record(any()) } just runs
            every { auditRepo.record(any()) } just runs
            every { outboxRepo.enqueue(any()) } just runs
            coEvery { redisPubSub.publish(any(), any()) } returns Unit

            return FakeRepos(
                drawRepo = drawRepo,
                ticketBoxRepo = ticketBoxRepo,
                prizeRepo = prizeRepo,
                playerRepo = playerRepo,
                campaignRepo = campaignRepo,
                queueRepo = queueRepo,
                drawPointTxRepo = drawPointTxRepo,
                outboxRepo = outboxRepo,
                auditRepo = auditRepo,
                redisPubSub = redisPubSub,
                drawnTicketIds = drawnTicketIds,
                boxStateRef = boxStateRef,
                soldOutBoxIds = soldOutBoxIds,
                campaignSoldOutCalled = campaignSoldOutCalled,
                savedInstanceGrades = savedInstanceGrades,
            )
        }

        fun buildUseCase(fakes: FakeRepos): DrawKujiUseCase =
            DrawKujiUseCase(
                DrawKujiDeps(
                    drawRepository = fakes.drawRepo,
                    ticketBoxRepository = fakes.ticketBoxRepo,
                    prizeRepository = fakes.prizeRepo,
                    playerRepository = fakes.playerRepo,
                    campaignRepository = fakes.campaignRepo,
                    queueRepository = fakes.queueRepo,
                    outboxRepository = fakes.outboxRepo,
                    drawCore =
                        DrawCore(
                            DrawCoreDeps(
                                playerRepository = fakes.playerRepo,
                                prizeRepository = fakes.prizeRepo,
                                drawPointTxRepository = fakes.drawPointTxRepo,
                                outboxRepository = fakes.outboxRepo
                            )
                        ),
                    auditRepository = fakes.auditRepo,
                    domainService = KujiDrawDomainService(),
                    redisPubSub = fakes.redisPubSub,
                    feedService = mockk(relaxed = true),
                ),
            )

        // -------------------------------------------------------------------------
        // Standard 10-ticket box layout: A=1, B=2, C=3, D=4
        // -------------------------------------------------------------------------

        val gradeCounts10 = mapOf("A" to 1, "B" to 2, "C" to 3, "D" to 4)

        // -------------------------------------------------------------------------
        // Transaction mocking: installed once for the whole spec
        // -------------------------------------------------------------------------

        beforeSpec { TransactionTestHelper.mockTransactions() }
        afterSpec { TransactionTestHelper.unmockTransactions() }
        beforeEach { TransactionTestHelper.stubTransaction() }
        afterEach {
            clearAllMocks()
            TransactionTestHelper.stubTransaction()
        }

        // =========================================================================
        // Single-threaded full draw-out
        // =========================================================================

        describe("Single-threaded full draw-out") {

            it("drawing all 10 tickets from a box yields exactly the configured prize distribution") {
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 10)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val tickets = buildTickets(boxId, defs, gradeCounts10)
                val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                val useCase = buildUseCase(fakes)

                // Draw all 10 one by one
                repeat(10) {
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxId,
                        ticketIds = emptyList(),
                        quantity = 1,
                        playerCouponId = null,
                    )
                }

                // Exact grade distribution
                val gradeCounts =
                    fakes.savedInstanceGrades.values
                        .groupingBy { it }
                        .eachCount()
                gradeCounts["A"] shouldBe 1
                gradeCounts["B"] shouldBe 2
                gradeCounts["C"] shouldBe 3
                gradeCounts["D"] shouldBe 4

                // No ticket drawn twice — drawnTicketIds should equal tickets.size
                fakes.drawnTicketIds.size shouldBe 10

                // All drawn ticket IDs come from the original ticket pool
                val knownIds = tickets.map { it.id }.toSet()
                fakes.drawnTicketIds.keys.forEach { id ->
                    knownIds.contains(id) shouldBe true
                }
            }

            it("drawing all 20 tickets across 2 boxes yields exact total distribution") {
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxAId = UUID.randomUUID()
                val boxBId = UUID.randomUUID()
                val boxA = makeBox(id = boxAId, campaignId = campaignId, total = 10, displayOrder = 1)
                val boxB = makeBox(id = boxBId, campaignId = campaignId, total = 10, displayOrder = 2)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val ticketsA = buildTickets(boxAId, defs, gradeCounts10)
                val ticketsB = buildTickets(boxBId, defs, gradeCounts10)

                val fakes =
                    buildFakes(
                        campaign = campaign,
                        boxTicketMap = mapOf(boxAId to ticketsA, boxBId to ticketsB),
                        defsByGrade = defs,
                        player = player,
                        allBoxes = listOf(boxA, boxB),
                    )
                val useCase = buildUseCase(fakes)

                // Draw all from box A then all from box B
                repeat(10) {
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxAId,
                        ticketIds = emptyList(),
                        quantity = 1,
                        playerCouponId = null,
                    )
                }
                repeat(10) {
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxBId,
                        ticketIds = emptyList(),
                        quantity = 1,
                        playerCouponId = null,
                    )
                }

                // Total: 2 A, 4 B, 6 C, 8 D across both boxes
                val gradeCounts =
                    fakes.savedInstanceGrades.values
                        .groupingBy { it }
                        .eachCount()
                gradeCounts["A"] shouldBe 2
                gradeCounts["B"] shouldBe 4
                gradeCounts["C"] shouldBe 6
                gradeCounts["D"] shouldBe 8
                fakes.drawnTicketIds.size shouldBe 20
            }

            it("box remaining count decrements correctly and reaches exactly 0") {
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 10)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val tickets = buildTickets(boxId, defs, gradeCounts10)
                val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                val useCase = buildUseCase(fakes)

                repeat(10) { drawNumber ->
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxId,
                        ticketIds = emptyList(),
                        quantity = 1,
                        playerCouponId = null,
                    )
                    val remaining = fakes.boxStateRef[boxId]!!.get()
                    remaining shouldBe (10 - drawNumber - 1)
                    // Never negative
                    remaining shouldBeGreaterThanOrEqual 0
                }

                // Exactly zero after last draw
                fakes.boxStateRef[boxId]!!.get() shouldBe 0
            }

            it("box status transitions to SOLD_OUT when last ticket drawn") {
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 10)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val tickets = buildTickets(boxId, defs, gradeCounts10)
                val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                val useCase = buildUseCase(fakes)

                // Draw 9 tickets — box must still be AVAILABLE
                repeat(9) {
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxId,
                        ticketIds = emptyList(),
                        quantity = 1,
                        playerCouponId = null,
                    )
                }
                fakes.soldOutBoxIds.containsKey(boxId) shouldBe false

                // Draw the 10th — box must now be SOLD_OUT
                useCase.execute(
                    playerId = player.id,
                    ticketBoxId = boxId,
                    ticketIds = emptyList(),
                    quantity = 1,
                    playerCouponId = null,
                )
                fakes.soldOutBoxIds.containsKey(boxId) shouldBe true
                fakes.boxStateRef[boxId]!!.get() shouldBe 0
            }

            it("campaign transitions to SOLD_OUT when all boxes sold out") {
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxAId = UUID.randomUUID()
                val boxBId = UUID.randomUUID()
                val boxA = makeBox(id = boxAId, campaignId = campaignId, total = 10, displayOrder = 1)
                val boxB = makeBox(id = boxBId, campaignId = campaignId, total = 10, displayOrder = 2)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val ticketsA = buildTickets(boxAId, defs, gradeCounts10)
                val ticketsB = buildTickets(boxBId, defs, gradeCounts10)

                val fakes =
                    buildFakes(
                        campaign = campaign,
                        boxTicketMap = mapOf(boxAId to ticketsA, boxBId to ticketsB),
                        defsByGrade = defs,
                        player = player,
                        allBoxes = listOf(boxA, boxB),
                    )
                val useCase = buildUseCase(fakes)

                // Exhaust box A — campaign must NOT yet be SOLD_OUT
                repeat(10) {
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxAId,
                        ticketIds = emptyList(),
                        quantity = 1,
                        playerCouponId = null,
                    )
                }
                fakes.soldOutBoxIds.containsKey(boxAId) shouldBe true
                fakes.campaignSoldOutCalled.get() shouldBe 0

                // Exhaust box B — campaign must now be SOLD_OUT
                repeat(10) {
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxBId,
                        ticketIds = emptyList(),
                        quantity = 1,
                        playerCouponId = null,
                    )
                }
                fakes.soldOutBoxIds.containsKey(boxBId) shouldBe true
                fakes.campaignSoldOutCalled.get() shouldBe 1
            }

            it("attempt to draw from sold-out box throws error") {
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 10)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val tickets = buildTickets(boxId, defs, gradeCounts10)
                val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                val useCase = buildUseCase(fakes)

                // Draw all 10
                repeat(10) {
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxId,
                        ticketIds = emptyList(),
                        quantity = 1,
                        playerCouponId = null,
                    )
                }

                // 11th draw must fail with DrawValidationException (no tickets available)
                shouldThrow<DomainDrawValidationException> {
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxId,
                        ticketIds = emptyList(),
                        quantity = 1,
                        playerCouponId = null,
                    )
                }

                // Remaining stays at 0 — not -1
                fakes.boxStateRef[boxId]!!.get() shouldBe 0
                // Total drawn stays at 10 — no new entry added
                fakes.drawnTicketIds.size shouldBe 10
            }
        }

        // =========================================================================
        // Multi-draw inventory integrity
        // =========================================================================

        describe("Multi-draw inventory integrity") {

            it("multi-draw of 3 from a 10-ticket box yields exactly 3 prizes") {
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 10)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val tickets = buildTickets(boxId, defs, gradeCounts10)
                val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                val useCase = buildUseCase(fakes)

                val result =
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxId,
                        ticketIds = emptyList(),
                        quantity = 3,
                        playerCouponId = null,
                    )

                result.tickets shouldHaveSize 3
                fakes.drawnTicketIds.size shouldBe 3
                fakes.boxStateRef[boxId]!!.get() shouldBe 7

                // All 3 ticket IDs unique
                result.tickets
                    .map { it.ticketId }
                    .distinct()
                    .size shouldBe 3
            }

            it("multi-draw of 5 when only 3 remain fails without partial draw") {
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 10, remaining = 3)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                // Build only 3 remaining available tickets (simulate 7 already drawn)
                val allTickets = buildTickets(boxId, defs, gradeCounts10)
                val (alreadyDrawn, stillAvailable) = allTickets.partition { it.position <= 7 }

                val fakes =
                    buildFakes(
                        campaign = campaign,
                        boxTicketMap = mapOf(boxId to stillAvailable),
                        defsByGrade = defs,
                        player = player,
                        allBoxes = listOf(box),
                    )
                val useCase = buildUseCase(fakes)

                // Requesting 5 when only 3 remain must throw before any state change
                shouldThrow<DomainDrawValidationException> {
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxId,
                        ticketIds = emptyList(),
                        quantity = 5,
                        playerCouponId = null,
                    )
                }

                // No tickets consumed — remaining unchanged at 3
                fakes.drawnTicketIds.size shouldBe 0
                fakes.boxStateRef[boxId]!!.get() shouldBe 3
            }

            it("sequential multi-draws exhaust box with exact prize counts") {
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 10)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val tickets = buildTickets(boxId, defs, gradeCounts10)
                val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                val useCase = buildUseCase(fakes)

                // 3 + 3 + 3 + 1 = 10
                val batchSizes = listOf(3, 3, 3, 1)
                var totalDrawn = 0
                for (qty in batchSizes) {
                    val result =
                        useCase.execute(
                            playerId = player.id,
                            ticketBoxId = boxId,
                            ticketIds = emptyList(),
                            quantity = qty,
                            playerCouponId = null,
                        )
                    result.tickets shouldHaveSize qty
                    totalDrawn += qty
                    fakes.drawnTicketIds.size shouldBe totalDrawn
                }

                totalDrawn shouldBe 10
                fakes.boxStateRef[boxId]!!.get() shouldBe 0

                val gradeCounts =
                    fakes.savedInstanceGrades.values
                        .groupingBy { it }
                        .eachCount()
                gradeCounts["A"] shouldBe 1
                gradeCounts["B"] shouldBe 2
                gradeCounts["C"] shouldBe 3
                gradeCounts["D"] shouldBe 4
            }

            it("multi-draw 12 (maximum) from a 12-ticket box works correctly") {
                // Box: A=2, B=3, C=4, D=3  total=12
                val gradeCounts12 = mapOf("A" to 2, "B" to 3, "C" to 4, "D" to 3)
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 12)

                val defs =
                    gradeCounts12.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val tickets = buildTickets(boxId, defs, gradeCounts12)
                val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                val useCase = buildUseCase(fakes)

                val result =
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxId,
                        ticketIds = emptyList(),
                        quantity = 12,
                        playerCouponId = null,
                    )

                result.tickets shouldHaveSize 12
                fakes.drawnTicketIds.size shouldBe 12
                fakes.boxStateRef[boxId]!!.get() shouldBe 0
                fakes.soldOutBoxIds.containsKey(boxId) shouldBe true

                val gradeCounts =
                    fakes.savedInstanceGrades.values
                        .groupingBy { it }
                        .eachCount()
                gradeCounts["A"] shouldBe 2
                gradeCounts["B"] shouldBe 3
                gradeCounts["C"] shouldBe 4
                gradeCounts["D"] shouldBe 3
            }
        }

        // =========================================================================
        // Concurrent draw inventory safety
        // =========================================================================

        describe("Concurrent draw inventory safety") {

            it("10 concurrent single draws on a 10-ticket box: exactly 10 succeed, 0 fail") {
                // Pre-assign one distinct ticket per coroutine so there are no selection races.
                // This simulates the real-world scenario where the session queue ensures each
                // player has exclusive access to their chosen ticket before entering the transaction.
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 10)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val tickets = buildTickets(boxId, defs, gradeCounts10)
                val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                val useCase = buildUseCase(fakes)

                val successCount = AtomicInteger(0)
                val failCount = AtomicInteger(0)

                coroutineScope {
                    // Each coroutine draws its own unique, pre-selected ticket
                    val jobs =
                        tickets.map { ticket ->
                            async {
                                try {
                                    useCase.execute(
                                        playerId = player.id,
                                        ticketBoxId = boxId,
                                        ticketIds = listOf(ticket.id),
                                        quantity = 1,
                                        playerCouponId = null,
                                    )
                                    successCount.incrementAndGet()
                                } catch (_: Exception) {
                                    failCount.incrementAndGet()
                                }
                            }
                        }
                    jobs.awaitAll()
                }

                successCount.get() shouldBe 10
                failCount.get() shouldBe 0
                fakes.drawnTicketIds.size shouldBe 10
                fakes.boxStateRef[boxId]!!.get() shouldBe 0

                // No duplicate ticket IDs
                fakes.drawnTicketIds.size shouldBe
                    fakes.drawnTicketIds.keys
                        .distinct()
                        .size
            }

            it("20 concurrent draws on a 10-ticket box: exactly 10 succeed, 10 fail") {
                // Submit each of the 10 valid tickets twice concurrently.
                // First attempt wins the CAS in markDrawn; second attempt throws because
                // the ticket is already DRAWN — exactly mirroring the real DB unique constraint.
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 10)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val tickets = buildTickets(boxId, defs, gradeCounts10)
                val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                val useCase = buildUseCase(fakes)

                val successCount = AtomicInteger(0)
                val failCount = AtomicInteger(0)

                coroutineScope {
                    // Submit every ticket twice: first submission wins, second fails
                    val jobs =
                        (tickets + tickets).map { ticket ->
                            async {
                                try {
                                    useCase.execute(
                                        playerId = player.id,
                                        ticketBoxId = boxId,
                                        ticketIds = listOf(ticket.id),
                                        quantity = 1,
                                        playerCouponId = null,
                                    )
                                    successCount.incrementAndGet()
                                } catch (_: Exception) {
                                    failCount.incrementAndGet()
                                }
                            }
                        }
                    jobs.awaitAll()
                }

                successCount.get() shouldBe 10
                failCount.get() shouldBe 10

                // Remaining MUST be exactly 0 — never negative
                fakes.boxStateRef[boxId]!!.get() shouldBe 0

                // Total drawn must be exactly 10 — no duplicate prize instances
                fakes.drawnTicketIds.size shouldBe 10

                // Exact prize distribution preserved under concurrency
                val gradeCounts =
                    fakes.savedInstanceGrades.values
                        .groupingBy { it }
                        .eachCount()
                gradeCounts["A"] shouldBe 1
                gradeCounts["B"] shouldBe 2
                gradeCounts["C"] shouldBe 3
                gradeCounts["D"] shouldBe 4
            }

            it("5 concurrent multi-draw-3 on a 10-ticket box: total drawn <= 10 and >= 0 remaining") {
                // 5 coroutines each request a random multi-draw of 3 (total demand: 15 tickets, box has 10).
                // Because validateMultiDraw reads the stale box snapshot and concurrent coroutines race
                // on findAvailableTickets + markDrawn, the total drawn must never exceed 10 and the
                // remaining count must never go negative.
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 10)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val tickets = buildTickets(boxId, defs, gradeCounts10)
                val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                val useCase = buildUseCase(fakes)

                val successCount = AtomicInteger(0)

                coroutineScope {
                    val jobs =
                        (1..5).map {
                            async {
                                try {
                                    useCase.execute(
                                        playerId = player.id,
                                        ticketBoxId = boxId,
                                        ticketIds = emptyList(),
                                        quantity = 3,
                                        playerCouponId = null,
                                    )
                                    successCount.incrementAndGet()
                                } catch (_: Exception) {
                                    // Expected for requests that exceed remaining capacity
                                }
                            }
                        }
                    jobs.awaitAll()
                }

                val totalDrawn = fakes.drawnTicketIds.size
                val remaining = fakes.boxStateRef[boxId]!!.get()

                // Core invariants: never exceed box capacity, never go negative
                totalDrawn shouldBeLessThanOrEqual 10
                remaining shouldBeGreaterThanOrEqual 0

                // No duplicate ticket IDs regardless of concurrency
                fakes.drawnTicketIds.size shouldBe
                    fakes.drawnTicketIds.keys
                        .distinct()
                        .size
            }

            it("concurrent draws never produce duplicate ticket assignments") {
                // 50 concurrent draws on a 20-ticket campaign (2 boxes of 10)
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxAId = UUID.randomUUID()
                val boxBId = UUID.randomUUID()
                val boxA = makeBox(id = boxAId, campaignId = campaignId, total = 10, displayOrder = 1)
                val boxB = makeBox(id = boxBId, campaignId = campaignId, total = 10, displayOrder = 2)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val ticketsA = buildTickets(boxAId, defs, gradeCounts10)
                val ticketsB = buildTickets(boxBId, defs, gradeCounts10)

                val fakes =
                    buildFakes(
                        campaign = campaign,
                        boxTicketMap = mapOf(boxAId to ticketsA, boxBId to ticketsB),
                        defsByGrade = defs,
                        player = player,
                        allBoxes = listOf(boxA, boxB),
                    )
                val useCase = buildUseCase(fakes)

                coroutineScope {
                    // 25 concurrent draws on each box
                    val jobsA =
                        (1..25).map {
                            async {
                                runCatching {
                                    useCase.execute(
                                        playerId = player.id,
                                        ticketBoxId = boxAId,
                                        ticketIds = emptyList(),
                                        quantity = 1,
                                        playerCouponId = null,
                                    )
                                }
                            }
                        }
                    val jobsB =
                        (1..25).map {
                            async {
                                runCatching {
                                    useCase.execute(
                                        playerId = player.id,
                                        ticketBoxId = boxBId,
                                        ticketIds = emptyList(),
                                        quantity = 1,
                                        playerCouponId = null,
                                    )
                                }
                            }
                        }
                    (jobsA + jobsB).awaitAll()
                }

                val totalDrawn = fakes.drawnTicketIds.size
                totalDrawn shouldBeLessThanOrEqual 20

                // The critical invariant: no ticket assigned twice
                val allAssignedTicketIds = fakes.drawnTicketIds.keys.toList()
                allAssignedTicketIds.distinct().size shouldBe allAssignedTicketIds.size

                // Combined remaining must not be negative
                val remainingA = fakes.boxStateRef[boxAId]!!.get()
                val remainingB = fakes.boxStateRef[boxBId]!!.get()
                remainingA shouldBeGreaterThanOrEqual 0
                remainingB shouldBeGreaterThanOrEqual 0
            }
        }

        // =========================================================================
        // Prize grade distribution invariant
        // =========================================================================

        describe("Prize grade distribution invariant") {

            it("random multi-draw always respects grade counts across 100 independent box iterations") {
                // Each iteration creates a fresh box with A=2, B=3, C=5 and draws all 10 randomly.
                // Every iteration must yield exactly A=2, B=3, C=5.
                val gradeCounts = mapOf("A" to 2, "B" to 3, "C" to 5)

                repeat(100) { iteration ->
                    val campaignId = CampaignId.generate()
                    val campaign = makeCampaign(campaignId)
                    val player = makePlayer()
                    val boxId = UUID.randomUUID()
                    val box = makeBox(id = boxId, campaignId = campaignId, total = 10)

                    val defs =
                        gradeCounts.entries.associate { (grade, count) ->
                            grade to makeDef(campaignId, grade, count)
                        }
                    val tickets = buildTickets(boxId, defs, gradeCounts)
                    val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                    val useCase = buildUseCase(fakes)

                    // Draw all 10 in one multi-draw
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxId,
                        ticketIds = emptyList(),
                        quantity = 10,
                        playerCouponId = null,
                    )

                    val counts =
                        fakes.savedInstanceGrades.values
                            .groupingBy { it }
                            .eachCount()
                    counts["A"] shouldBe 2
                    counts["B"] shouldBe 3
                    counts["C"] shouldBe 5
                }
            }

            it("selectRandomTickets never selects a ticket that has already been drawn") {
                // Use the domain service directly — no use case, no I/O.
                val domainService = KujiDrawDomainService()
                val campaignId = CampaignId.generate()
                val defId = PrizeDefinitionId.generate()

                fun ticket(
                    pos: Int,
                    status: DrawTicketStatus,
                ) = DrawTicket(
                    id = UUID.randomUUID(),
                    ticketBoxId = UUID.randomUUID(),
                    prizeDefinitionId = defId,
                    position = pos,
                    status = status,
                    drawnByPlayerId = null,
                    drawnAt = null,
                    prizeInstanceId = null,
                    createdAt = now,
                    updatedAt = now,
                )

                val drawn = (1..5).map { ticket(it, DrawTicketStatus.DRAWN) }
                val available = (6..10).map { ticket(it, DrawTicketStatus.AVAILABLE) }
                val drawnIds = drawn.map { it.id }.toSet()

                // selectRandomTickets receives only the available pool
                repeat(50) {
                    val selected = domainService.selectRandomTickets(available, 3)
                    selected shouldHaveSize 3
                    selected.forEach { t ->
                        drawnIds.contains(t.id) shouldBe false
                        t.status shouldBe DrawTicketStatus.AVAILABLE
                    }
                }
            }

            it("each ticket maps to exactly one prize definition — no prize duplication at setup") {
                val campaignId = CampaignId.generate()
                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val boxId = UUID.randomUUID()
                val tickets = buildTickets(boxId, defs, gradeCounts10)

                // Verify the ticket layout before any draws:
                // total tickets == sum of grade counts
                tickets.size shouldBe 10

                // Count per prizeDefinitionId matches the declared ticketCount
                val countByDefId = tickets.groupingBy { it.prizeDefinitionId }.eachCount()
                for ((grade, count) in gradeCounts10) {
                    val def = defs[grade]!!
                    countByDefId[def.id] shouldBe count
                }

                // No two tickets share the same position (positions are unique within the box)
                val positions = tickets.map { it.position }
                positions.distinct().size shouldBe positions.size
            }
        }

        // =========================================================================
        // Edge cases
        // =========================================================================

        describe("Edge cases") {

            it("box with 1 ticket: single draw gives that exact prize") {
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 1)

                val def = makeDef(campaignId, "A", 1)
                val defs = mapOf("A" to def)
                val tickets = buildTickets(boxId, defs, mapOf("A" to 1))
                val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                val useCase = buildUseCase(fakes)

                val result =
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxId,
                        ticketIds = emptyList(),
                        quantity = 1,
                        playerCouponId = null,
                    )

                result.tickets shouldHaveSize 1
                result.tickets.first().grade shouldBe "A"
                fakes.boxStateRef[boxId]!!.get() shouldBe 0
                fakes.soldOutBoxIds.containsKey(boxId) shouldBe true
            }

            it("campaign with 1 box and 1 ticket: sold out after 1 draw") {
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 1)

                val def = makeDef(campaignId, "A", 1)
                val defs = mapOf("A" to def)
                val tickets = buildTickets(boxId, defs, mapOf("A" to 1))
                val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                val useCase = buildUseCase(fakes)

                useCase.execute(
                    playerId = player.id,
                    ticketBoxId = boxId,
                    ticketIds = emptyList(),
                    quantity = 1,
                    playerCouponId = null,
                )

                // Campaign SOLD_OUT triggered because the only box is now SOLD_OUT
                fakes.campaignSoldOutCalled.get() shouldBe 1
            }

            it("box with 80 tickets (realistic size): full draw-out integrity") {
                // A=5, B=10, C=25, D=40  total=80
                val gradeCounts80 = mapOf("A" to 5, "B" to 10, "C" to 25, "D" to 40)
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                val box = makeBox(id = boxId, campaignId = campaignId, total = 80)

                val defs =
                    gradeCounts80.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                val tickets = buildTickets(boxId, defs, gradeCounts80)
                val fakes = buildFakes(campaign, mapOf(boxId to tickets), defs, player, listOf(box))
                val useCase = buildUseCase(fakes)

                // Draw all 80 via batches of 10 to keep the test exercising multi-draw paths
                repeat(8) {
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxId,
                        ticketIds = emptyList(),
                        quantity = 10,
                        playerCouponId = null,
                    )
                }

                fakes.drawnTicketIds.size shouldBe 80
                fakes.boxStateRef[boxId]!!.get() shouldBe 0

                val gradeCounts =
                    fakes.savedInstanceGrades.values
                        .groupingBy { it }
                        .eachCount()
                gradeCounts["A"] shouldBe 5
                gradeCounts["B"] shouldBe 10
                gradeCounts["C"] shouldBe 25
                gradeCounts["D"] shouldBe 40
            }

            it("multi-draw exactly equal to remaining tickets succeeds and marks box SOLD_OUT") {
                val campaignId = CampaignId.generate()
                val campaign = makeCampaign(campaignId)
                val player = makePlayer()
                val boxId = UUID.randomUUID()
                // Box has 10 total, 5 remain (simulate 5 already drawn)
                val box = makeBox(id = boxId, campaignId = campaignId, total = 10, remaining = 5)

                val defs =
                    gradeCounts10.entries.associate { (grade, count) ->
                        grade to makeDef(campaignId, grade, count)
                    }
                // Only the last 5 tickets are still AVAILABLE
                val allTickets = buildTickets(boxId, defs, gradeCounts10)
                val availableTickets = allTickets.takeLast(5)

                val fakes =
                    buildFakes(
                        campaign = campaign,
                        boxTicketMap = mapOf(boxId to availableTickets),
                        defsByGrade = defs,
                        player = player,
                        allBoxes = listOf(box),
                    )
                val useCase = buildUseCase(fakes)

                // multi-draw exactly 5 (== remaining) must succeed — not fail with "not enough"
                val result =
                    useCase.execute(
                        playerId = player.id,
                        ticketBoxId = boxId,
                        ticketIds = emptyList(),
                        quantity = 5,
                        playerCouponId = null,
                    )

                result.tickets shouldHaveSize 5
                fakes.drawnTicketIds.size shouldBe 5
                fakes.boxStateRef[boxId]!!.get() shouldBe 0
                fakes.soldOutBoxIds.containsKey(boxId) shouldBe true
            }
        }
    })
