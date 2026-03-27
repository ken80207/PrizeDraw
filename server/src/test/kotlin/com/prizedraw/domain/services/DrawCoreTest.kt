package com.prizedraw.domain.services

import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.domain.entities.DrawPointTransaction
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.entities.PrizeInstance
import com.prizedraw.domain.valueobjects.PlayerId
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import kotlinx.datetime.Clock
import java.util.UUID

/**
 * Unit tests for [DrawCore].
 *
 * All repositories are mocked. Tests cover:
 * - Weighted random fairness (CDF + SecureRandom)
 * - Input validation (empty pool, zero quantity)
 * - Balance debit correctness and validation
 * - PrizeInstance creation and metadata propagation
 * - Transaction ledger recording
 * - Outbox event enqueueing
 * - Optimistic lock retry and exhaustion
 * - Free draw (zero price) behaviour
 */
class DrawCoreTest :
    DescribeSpec({

        // ──────────────────────────────────────────────────────────────────────────
        // Shared fixtures
        // ──────────────────────────────────────────────────────────────────────────

        val now = Clock.System.now()

        fun makePlayer(
            balance: Int = 1000,
            version: Int = 0,
        ) = Player(
            id = PlayerId.generate(),
            nickname = "Tester",
            avatarUrl = null,
            phoneNumber = null,
            phoneVerifiedAt = null,
            oauthProvider = OAuthProvider.GOOGLE,
            oauthSubject = "sub-test",
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

        fun makePool(vararg weights: Int): List<PrizePoolEntry> =
            weights.mapIndexed { index, w ->
                PrizePoolEntry(prizeDefinitionId = UUID.randomUUID(), weight = w)
            }

        fun makeDeps(
            playerRepo: IPlayerRepository = mockk(relaxed = true),
            prizeRepo: IPrizeRepository = mockk(relaxed = true),
            txRepo: IDrawPointTransactionRepository = mockk(relaxed = true),
            outboxRepo: IOutboxRepository = mockk(relaxed = true),
        ) = DrawCoreDeps(
            playerRepository = playerRepo,
            prizeRepository = prizeRepo,
            drawPointTxRepository = txRepo,
            outboxRepository = outboxRepo,
        )

        // ──────────────────────────────────────────────────────────────────────────
        // Weighted random fairness
        // ──────────────────────────────────────────────────────────────────────────

        describe("weighted random selection") {

            it("respects weights in a 70/20/10 split over 10,000 draws") {
                val defA = UUID.randomUUID()
                val defB = UUID.randomUUID()
                val defC = UUID.randomUUID()

                val pool =
                    listOf(
                        PrizePoolEntry(prizeDefinitionId = defA, weight = 700_000),
                        PrizePoolEntry(prizeDefinitionId = defB, weight = 200_000),
                        PrizePoolEntry(prizeDefinitionId = defC, weight = 100_000),
                    )

                val player = makePlayer(balance = 0)
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(playerRepo, prizeRepo, txRepo, outboxRepo))

                val totalDraws = 10_000
                val counts = mutableMapOf(defA to 0, defB to 0, defC to 0)

                repeat(totalDraws) {
                    val outcomes =
                        core.draw(
                            playerId = player.id,
                            pool = pool,
                            quantity = 1,
                            pricePerDraw = 0,
                        )
                    counts.merge(outcomes.first().prizeDefinitionId, 1, Int::plus)
                }

                val rateA = counts[defA]!!.toDouble() / totalDraws
                val rateB = counts[defB]!!.toDouble() / totalDraws
                val rateC = counts[defC]!!.toDouble() / totalDraws

                // 2% tolerance is well within 3-sigma for 10k samples
                rateA shouldBe (0.70 plusOrMinus 0.02)
                rateB shouldBe (0.20 plusOrMinus 0.02)
                rateC shouldBe (0.10 plusOrMinus 0.02)
            }

            it("produces uniform distribution for equal-weight pool over 10,000 draws") {
                val ids = List(4) { UUID.randomUUID() }
                val pool = ids.map { PrizePoolEntry(prizeDefinitionId = it, weight = 1) }

                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(prizeRepo = prizeRepo, txRepo = txRepo, outboxRepo = outboxRepo))
                val counts = ids.associateWith { 0 }.toMutableMap()
                val totalDraws = 10_000

                repeat(totalDraws) {
                    val outcome =
                        core.draw(
                            playerId = PlayerId.generate(),
                            pool = pool,
                            quantity = 1,
                            pricePerDraw = 0,
                        )
                    counts.merge(outcome.first().prizeDefinitionId, 1, Int::plus)
                }

                ids.forEach { id ->
                    val rate = counts[id]!!.toDouble() / totalDraws
                    // Expected 25% ± 3%
                    rate shouldBe (0.25 plusOrMinus 0.03)
                }
            }

            it("always returns the only entry for a single-entry pool") {
                val onlyId = UUID.randomUUID()
                val pool = listOf(PrizePoolEntry(prizeDefinitionId = onlyId, weight = 1))

                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(prizeRepo = prizeRepo, txRepo = txRepo, outboxRepo = outboxRepo))

                repeat(100) {
                    val outcomes =
                        core.draw(
                            playerId = PlayerId.generate(),
                            pool = pool,
                            quantity = 1,
                            pricePerDraw = 0,
                        )
                    outcomes.first().prizeDefinitionId shouldBe onlyId
                }
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // Balance debit
        // ──────────────────────────────────────────────────────────────────────────

        describe("balance debit") {

            afterEach { clearAllMocks() }

            it("deducts correct total cost from player balance (price=100, qty=3, discount=50)") {
                val player = makePlayer(balance = 500, version = 7)
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { playerRepo.findById(player.id) } returns player
                coEvery { playerRepo.updateBalance(player.id, any(), any(), any()) } returns true
                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(playerRepo, prizeRepo, txRepo, outboxRepo))

                core.draw(
                    playerId = player.id,
                    pool = makePool(1),
                    quantity = 3,
                    pricePerDraw = 100,
                    discountAmount = 50,
                )

                // totalCost = 100 * 3 - 50 = 250
                coVerify(exactly = 1) {
                    playerRepo.updateBalance(
                        id = player.id,
                        drawPointsDelta = -250,
                        revenuePointsDelta = 0,
                        expectedVersion = 7,
                    )
                }
            }

            it("throws when player balance is insufficient") {
                val player = makePlayer(balance = 50)
                val playerRepo = mockk<IPlayerRepository>()

                coEvery { playerRepo.findById(player.id) } returns player

                val core = DrawCore(makeDeps(playerRepo = playerRepo))

                val ex =
                    shouldThrow<IllegalStateException> {
                        core.draw(
                            playerId = player.id,
                            pool = makePool(1),
                            quantity = 1,
                            pricePerDraw = 100,
                        )
                    }
                ex.message shouldNotBe null
                ex.message!!.contains("Insufficient balance", ignoreCase = true) shouldBe true
            }

            it("does not call updateBalance when pricePerDraw is zero") {
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(playerRepo, prizeRepo, txRepo, outboxRepo))

                core.draw(
                    playerId = PlayerId.generate(),
                    pool = makePool(1),
                    quantity = 1,
                    pricePerDraw = 0,
                )

                coVerify(exactly = 0) { playerRepo.findById(any()) }
                coVerify(exactly = 0) { playerRepo.updateBalance(any(), any(), any(), any()) }
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // PrizeInstance creation
        // ──────────────────────────────────────────────────────────────────────────

        describe("PrizeInstance creation") {

            afterEach { clearAllMocks() }

            it("calls saveInstance once per outcome for a 3-draw") {
                val player = makePlayer(balance = 0)
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(prizeRepo = prizeRepo, txRepo = txRepo, outboxRepo = outboxRepo))

                core.draw(
                    playerId = player.id,
                    pool = makePool(1),
                    quantity = 3,
                    pricePerDraw = 0,
                )

                coVerify(exactly = 3) { prizeRepo.saveInstance(any()) }
            }

            it("creates PrizeInstances with correct prizeDefinitionId, ownerId, and state=HOLDING") {
                val defId = UUID.randomUUID()
                val pool = listOf(PrizePoolEntry(prizeDefinitionId = defId, weight = 1))
                val player = makePlayer(balance = 0)
                val capturedInstances = mutableListOf<PrizeInstance>()

                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(capture(capturedInstances)) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(prizeRepo = prizeRepo, txRepo = txRepo, outboxRepo = outboxRepo))

                core.draw(
                    playerId = player.id,
                    pool = pool,
                    quantity = 2,
                    pricePerDraw = 0,
                )

                capturedInstances.size shouldBe 2
                capturedInstances.forEach { instance ->
                    instance.prizeDefinitionId.value shouldBe defId
                    instance.ownerId shouldBe player.id
                    instance.state shouldBe PrizeState.HOLDING
                }
            }

            it("passes metadata from pool entry through to DrawOutcome") {
                val ticketUuid = UUID.randomUUID().toString()
                val pool =
                    listOf(
                        PrizePoolEntry(
                            prizeDefinitionId = UUID.randomUUID(),
                            weight = 1,
                            metadata = mapOf("ticketId" to ticketUuid, "position" to "5"),
                        ),
                    )

                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(prizeRepo = prizeRepo, txRepo = txRepo, outboxRepo = outboxRepo))

                val outcomes =
                    core.draw(
                        playerId = PlayerId.generate(),
                        pool = pool,
                        quantity = 1,
                        pricePerDraw = 0,
                    )

                outcomes.first().metadata["ticketId"] shouldBe ticketUuid
                outcomes.first().metadata["position"] shouldBe "5"
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // Validation guards
        // ──────────────────────────────────────────────────────────────────────────

        describe("input validation") {

            it("throws IllegalArgumentException for empty pool") {
                val core = DrawCore(makeDeps())
                shouldThrow<IllegalArgumentException> {
                    core.draw(
                        playerId = PlayerId.generate(),
                        pool = emptyList(),
                        quantity = 1,
                        pricePerDraw = 0,
                    )
                }
            }

            it("throws IllegalArgumentException for zero quantity") {
                val core = DrawCore(makeDeps())
                shouldThrow<IllegalArgumentException> {
                    core.draw(
                        playerId = PlayerId.generate(),
                        pool = makePool(1),
                        quantity = 0,
                        pricePerDraw = 0,
                    )
                }
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // Transaction ledger recording
        // ──────────────────────────────────────────────────────────────────────────

        describe("draw point transaction ledger") {

            afterEach { clearAllMocks() }

            it("records a DrawPointTransaction for each draw outcome") {
                val capturedTxs = mutableListOf<DrawPointTransaction>()
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(capture(capturedTxs)) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(prizeRepo = prizeRepo, txRepo = txRepo, outboxRepo = outboxRepo))

                core.draw(
                    playerId = PlayerId.generate(),
                    pool = makePool(1),
                    quantity = 2,
                    pricePerDraw = 0,
                )

                capturedTxs.size shouldBe 2
            }

            it("records transactions with correct type and negative amount for paid draws") {
                val player = makePlayer(balance = 500)
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { playerRepo.findById(player.id) } returns player
                coEvery { playerRepo.updateBalance(any(), any(), any(), any()) } returns true
                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                val capturedTxs = mutableListOf<DrawPointTransaction>()
                every { txRepo.record(capture(capturedTxs)) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(playerRepo, prizeRepo, txRepo, outboxRepo))

                core.draw(
                    playerId = player.id,
                    pool = makePool(1),
                    quantity = 2,
                    pricePerDraw = 100,
                )

                // quantity > 1: each per-draw cost = pricePerDraw = 100
                capturedTxs.size shouldBe 2
                capturedTxs.forEach { tx ->
                    tx.type shouldBe DrawPointTxType.KUJI_DRAW_DEBIT
                    tx.amount shouldBe -100
                    tx.playerId shouldBe player.id
                }
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // Outbox event enqueueing
        // ──────────────────────────────────────────────────────────────────────────

        describe("outbox event enqueueing") {

            afterEach { clearAllMocks() }

            it("enqueues one outbox event per draw outcome") {
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(prizeRepo = prizeRepo, txRepo = txRepo, outboxRepo = outboxRepo))

                core.draw(
                    playerId = PlayerId.generate(),
                    pool = makePool(1),
                    quantity = 1,
                    pricePerDraw = 0,
                )

                coVerify(exactly = 1) { outboxRepo.enqueue(any()) }
            }

            it("enqueues one event per outcome for a multi-draw") {
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(prizeRepo = prizeRepo, txRepo = txRepo, outboxRepo = outboxRepo))

                core.draw(
                    playerId = PlayerId.generate(),
                    pool = makePool(1),
                    quantity = 3,
                    pricePerDraw = 0,
                )

                coVerify(exactly = 3) { outboxRepo.enqueue(any()) }
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // Optimistic lock retry
        // ──────────────────────────────────────────────────────────────────────────

        describe("optimistic lock retry for balance debit") {

            afterEach { clearAllMocks() }

            it("succeeds on the second attempt when first updateBalance returns false") {
                val player = makePlayer(balance = 200, version = 3)
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { playerRepo.findById(player.id) } returns player
                // First attempt fails (concurrent modification), second succeeds
                coEvery {
                    playerRepo.updateBalance(player.id, any(), any(), any())
                } returnsMany listOf(false, true)
                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(playerRepo, prizeRepo, txRepo, outboxRepo))

                val outcomes =
                    core.draw(
                        playerId = player.id,
                        pool = makePool(1),
                        quantity = 1,
                        pricePerDraw = 100,
                    )

                outcomes.size shouldBe 1
                coVerify(exactly = 2) { playerRepo.updateBalance(any(), any(), any(), any()) }
            }

            it("throws after MAX_BALANCE_RETRIES (3) exhausted") {
                val player = makePlayer(balance = 500)
                val playerRepo = mockk<IPlayerRepository>()

                coEvery { playerRepo.findById(player.id) } returns player
                coEvery { playerRepo.updateBalance(any(), any(), any(), any()) } returns false

                val core = DrawCore(makeDeps(playerRepo = playerRepo))

                val ex =
                    shouldThrow<IllegalStateException> {
                        core.draw(
                            playerId = player.id,
                            pool = makePool(1),
                            quantity = 1,
                            pricePerDraw = 100,
                        )
                    }
                ex.message shouldNotBe null
                ex.message!!.contains("retries", ignoreCase = true) shouldBe true

                // updateBalance called exactly MAX_BALANCE_RETRIES = 3 times
                coVerify(exactly = 3) { playerRepo.updateBalance(any(), any(), any(), any()) }
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // Per-draw cost split for multi-draw vs. single-draw
        // ──────────────────────────────────────────────────────────────────────────

        describe("per-draw pointsCharged in outcome") {

            afterEach { clearAllMocks() }

            it("single draw outcome carries totalCost (including discount applied)") {
                val player = makePlayer(balance = 500)
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { playerRepo.findById(player.id) } returns player
                coEvery { playerRepo.updateBalance(any(), any(), any(), any()) } returns true
                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(playerRepo, prizeRepo, txRepo, outboxRepo))

                val outcomes =
                    core.draw(
                        playerId = player.id,
                        pool = makePool(1),
                        quantity = 1,
                        pricePerDraw = 200,
                        discountAmount = 50,
                    )

                // quantity == 1 → pointsCharged = totalCost = 200 - 50 = 150
                outcomes.first().pointsCharged shouldBe 150
            }

            it("multi-draw outcome carries pricePerDraw (not discounted total)") {
                val player = makePlayer(balance = 1000)
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { playerRepo.findById(player.id) } returns player
                coEvery { playerRepo.updateBalance(any(), any(), any(), any()) } returns true
                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(playerRepo, prizeRepo, txRepo, outboxRepo))

                val outcomes =
                    core.draw(
                        playerId = player.id,
                        pool = makePool(1),
                        quantity = 3,
                        pricePerDraw = 100,
                        discountAmount = 50,
                    )

                // quantity > 1 → per-outcome cost = pricePerDraw = 100
                outcomes.forEach { it.pointsCharged shouldBe 100 }
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // Pre-selected pool entries (kuji mode)
        // ──────────────────────────────────────────────────────────────────────────

        describe("preSelected bypass") {

            it("uses preSelected entries instead of random selection") {
                val fixedId = UUID.randomUUID()
                val fixedEntry = PrizePoolEntry(prizeDefinitionId = fixedId, weight = 1)
                val otherEntry = PrizePoolEntry(prizeDefinitionId = UUID.randomUUID(), weight = 999_999)
                val pool = listOf(otherEntry) // would almost never draw fixedId via random

                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(prizeRepo = prizeRepo, txRepo = txRepo, outboxRepo = outboxRepo))

                val outcomes =
                    core.draw(
                        playerId = PlayerId.generate(),
                        pool = pool,
                        quantity = 1,
                        pricePerDraw = 0,
                        preSelected = listOf(fixedEntry),
                    )

                outcomes.first().prizeDefinitionId shouldBe fixedId
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // Outcome uniqueness
        // ──────────────────────────────────────────────────────────────────────────

        describe("DrawOutcome identity") {

            it("each draw outcome has a unique prizeInstanceId") {
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                // Capture to inspect
                val savedInstances = mutableListOf<PrizeInstance>()
                coEvery { prizeRepo.saveInstance(capture(savedInstances)) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = DrawCore(makeDeps(prizeRepo = prizeRepo, txRepo = txRepo, outboxRepo = outboxRepo))

                val outcomes =
                    core.draw(
                        playerId = PlayerId.generate(),
                        pool = makePool(1),
                        quantity = 5,
                        pricePerDraw = 0,
                    )

                val uniqueInstanceIds = outcomes.map { it.prizeInstanceId }.toSet()
                uniqueInstanceIds.size shouldBe 5
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // XP side-effect: does not throw when levelService is null
        // ──────────────────────────────────────────────────────────────────────────

        describe("XP award") {

            it("completes successfully when levelService is not configured") {
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val deps =
                    DrawCoreDeps(
                        playerRepository = mockk(relaxed = true),
                        prizeRepository = prizeRepo,
                        drawPointTxRepository = txRepo,
                        outboxRepository = outboxRepo,
                        levelService = null,
                    )
                val core = DrawCore(deps)

                val outcomes =
                    core.draw(
                        playerId = PlayerId.generate(),
                        pool = makePool(1),
                        quantity = 1,
                        pricePerDraw = 0,
                    )

                outcomes.size shouldBe 1
            }
        }
    })
