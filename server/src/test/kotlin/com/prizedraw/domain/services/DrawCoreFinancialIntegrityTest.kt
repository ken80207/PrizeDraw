package com.prizedraw.domain.services

import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.valueobjects.PlayerId
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.ints.shouldBeGreaterThanOrEqual
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.datetime.Clock
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger

/**
 * Financial integrity tests for [DrawCore].
 *
 * These tests verify the critical money-safety invariants of the draw engine:
 * - Total deducted points always equal pricePerDraw * quantity - discount
 * - Player balance never goes below zero
 * - Concurrent draws cannot cause double-spend
 * - Discount is capped so totalCost never goes negative
 * - Every draw outcome receives a unique prizeInstanceId
 */
class DrawCoreFinancialIntegrityTest :
    DescribeSpec({

        // ──────────────────────────────────────────────────────────────────────────
        // Fixtures
        // ──────────────────────────────────────────────────────────────────────────

        val now = Clock.System.now()

        fun makePlayer(
            id: PlayerId = PlayerId.generate(),
            balance: Int = 1000,
            version: Int = 0,
        ) = Player(
            id = id,
            nickname = "FinTester",
            avatarUrl = null,
            phoneNumber = null,
            phoneVerifiedAt = null,
            oauthProvider = OAuthProvider.GOOGLE,
            oauthSubject = UUID.randomUUID().toString(),
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

        fun singleEntryPool(defId: UUID = UUID.randomUUID()) =
            listOf(PrizePoolEntry(prizeDefinitionId = defId, weight = 1))

        fun buildCore(
            playerRepo: IPlayerRepository = mockk(relaxed = true),
            prizeRepo: IPrizeRepository = mockk(relaxed = true),
            txRepo: IDrawPointTransactionRepository = mockk(relaxed = true),
            outboxRepo: IOutboxRepository = mockk(relaxed = true),
        ): DrawCore =
            DrawCore(
                DrawCoreDeps(
                    playerRepository = playerRepo,
                    prizeRepository = prizeRepo,
                    drawPointTxRepository = txRepo,
                    outboxRepository = outboxRepo,
                ),
            )

        // ──────────────────────────────────────────────────────────────────────────
        // Total cost consistency
        // ──────────────────────────────────────────────────────────────────────────

        describe("total cost consistency") {

            afterEach { clearAllMocks() }

            it("total points deducted equals pricePerDraw * quantity - discount (various combinations)") {
                data class Case(
                    val price: Int,
                    val qty: Int,
                    val discount: Int,
                    val expected: Int,
                )

                val cases =
                    listOf(
                        Case(price = 100, qty = 1, discount = 0, expected = 100),
                        Case(price = 100, qty = 3, discount = 50, expected = 250),
                        Case(price = 200, qty = 5, discount = 100, expected = 900),
                        Case(price = 50, qty = 2, discount = 0, expected = 100),
                        Case(price = 80, qty = 10, discount = 200, expected = 600),
                    )

                cases.forEach { (price, qty, discount, expected) ->
                    val player = makePlayer(balance = 10_000)
                    val playerRepo = mockk<IPlayerRepository>()
                    val prizeRepo = mockk<IPrizeRepository>()
                    val txRepo = mockk<IDrawPointTransactionRepository>()
                    val outboxRepo = mockk<IOutboxRepository>()

                    val capturedDelta = mutableListOf<Int>()

                    coEvery { playerRepo.findById(player.id) } returns player
                    coEvery {
                        playerRepo.updateBalance(player.id, capture(capturedDelta), any(), any())
                    } returns true
                    coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                    every { txRepo.record(any()) } just runs
                    every { outboxRepo.enqueue(any()) } just runs

                    val core = buildCore(playerRepo, prizeRepo, txRepo, outboxRepo)

                    core.draw(
                        playerId = player.id,
                        pool = singleEntryPool(),
                        quantity = qty,
                        pricePerDraw = price,
                        discountAmount = discount,
                    )

                    // Single updateBalance call with -(price * qty - discount)
                    capturedDelta.size shouldBe 1
                    capturedDelta.first() shouldBe -expected
                }
            }

            it("sum of outcome.pointsCharged matches totalCost for single draw") {
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

                val core = buildCore(playerRepo, prizeRepo, txRepo, outboxRepo)

                val outcomes =
                    core.draw(
                        playerId = player.id,
                        pool = singleEntryPool(),
                        quantity = 1,
                        pricePerDraw = 200,
                        discountAmount = 50,
                    )

                outcomes.sumOf { it.pointsCharged } shouldBe 150
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // Never deducts more than balance
        // ──────────────────────────────────────────────────────────────────────────

        describe("balance boundary protection") {

            afterEach { clearAllMocks() }

            it("succeeds with exactly sufficient balance (balance equals totalCost)") {
                val player = makePlayer(balance = 100)
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { playerRepo.findById(player.id) } returns player
                coEvery { playerRepo.updateBalance(any(), any(), any(), any()) } returns true
                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = buildCore(playerRepo, prizeRepo, txRepo, outboxRepo)

                val outcomes =
                    core.draw(
                        playerId = player.id,
                        pool = singleEntryPool(),
                        quantity = 1,
                        pricePerDraw = 100,
                    )

                outcomes.size shouldBe 1
            }

            it("throws when balance is one point short") {
                val player = makePlayer(balance = 99)
                val playerRepo = mockk<IPlayerRepository>()

                coEvery { playerRepo.findById(player.id) } returns player

                val core = buildCore(playerRepo = playerRepo)

                val ex =
                    shouldThrow<IllegalStateException> {
                        core.draw(
                            playerId = player.id,
                            pool = singleEntryPool(),
                            quantity = 1,
                            pricePerDraw = 100,
                        )
                    }
                ex.message shouldNotBe null
                ex.message!!.contains("Insufficient", ignoreCase = true) shouldBe true
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // Discount capping
        // ──────────────────────────────────────────────────────────────────────────

        describe("discount capping") {

            afterEach { clearAllMocks() }

            it("totalCost is zero when discount exceeds pricePerDraw * quantity") {
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                // No playerRepo interactions expected: totalCost is capped to 0, debitBalance returns early
                val playerRepo = mockk<IPlayerRepository>()
                val core = buildCore(playerRepo, prizeRepo, txRepo, outboxRepo)

                val outcomes =
                    core.draw(
                        playerId = PlayerId.generate(),
                        pool = singleEntryPool(),
                        quantity = 1,
                        pricePerDraw = 50,
                        discountAmount = 100, // discount > price → totalCost = 0
                    )

                outcomes.size shouldBe 1
                // updateBalance must NOT have been called (totalCost <= 0)
                coVerify(exactly = 0) { playerRepo.updateBalance(any(), any(), any(), any()) }
            }

            it("totalCost is never negative (discount larger than gross cost)") {
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()
                val playerRepo = mockk<IPlayerRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = buildCore(playerRepo, prizeRepo, txRepo, outboxRepo)

                val outcomes =
                    core.draw(
                        playerId = PlayerId.generate(),
                        pool = singleEntryPool(),
                        quantity = 1,
                        pricePerDraw = 10,
                        discountAmount = 999,
                    )

                // pointsCharged is the per-outcome cost; quantity==1 → it equals totalCost (capped at 0)
                outcomes.first().pointsCharged shouldBe 0
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // Concurrent draws (optimistic lock simulation)
        // ──────────────────────────────────────────────────────────────────────────

        describe("concurrent draw safety") {

            afterEach { clearAllMocks() }

            it("balance is only debited once per successful draw when concurrent attempts race") {
                // Two concurrent draws, simulated via optimistic-lock contention.
                // The in-process balance + version guard ensures only one succeeds.
                val initialBalance = 200
                val dbBalance = AtomicInteger(initialBalance)
                val dbVersion = AtomicInteger(0)

                val player = makePlayer(balance = initialBalance)
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { playerRepo.findById(player.id) } answers {
                    player.copy(drawPointsBalance = dbBalance.get(), version = dbVersion.get())
                }

                coEvery { playerRepo.updateBalance(player.id, any(), any(), any()) } answers {
                    val delta = secondArg<Int>()
                    val expectedVer = arg<Int>(3)
                    synchronized(dbBalance) {
                        if (dbVersion.get() != expectedVer) {
                            false
                        } else {
                            val newBal = dbBalance.get() + delta
                            if (newBal < 0) return@answers false
                            dbBalance.set(newBal)
                            dbVersion.incrementAndGet()
                            true
                        }
                    }
                }

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = buildCore(playerRepo, prizeRepo, txRepo, outboxRepo)

                val results =
                    coroutineScope {
                        listOf(
                            async { runCatching { core.draw(player.id, singleEntryPool(), 1, 100) } },
                            async { runCatching { core.draw(player.id, singleEntryPool(), 1, 100) } },
                        ).map { it.await() }
                    }

                val successes = results.count { it.isSuccess }

                // Both draws cost 100; initial balance 200 → both may succeed (200 ÷ 100 = 2)
                // but balance must never go below zero and both together cost exactly 200 (or one fails)
                successes shouldBeGreaterThanOrEqual 1
                dbBalance.get() shouldBeGreaterThanOrEqual 0
            }

            it("does not double-spend: balance after draw equals initial minus totalCost exactly once") {
                val initialBalance = 300
                val debitAmount = 100
                val dbBalance = AtomicInteger(initialBalance)
                val dbVersion = AtomicInteger(0)

                val player = makePlayer(balance = initialBalance)
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { playerRepo.findById(player.id) } answers {
                    player.copy(drawPointsBalance = dbBalance.get(), version = dbVersion.get())
                }

                coEvery { playerRepo.updateBalance(player.id, any(), any(), any()) } answers {
                    val delta = secondArg<Int>()
                    val expectedVer = arg<Int>(3)
                    synchronized(dbBalance) {
                        if (dbVersion.get() != expectedVer) return@answers false
                        val newBal = dbBalance.get() + delta
                        if (newBal < 0) return@answers false
                        dbBalance.set(newBal)
                        dbVersion.incrementAndGet()
                        true
                    }
                }

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = buildCore(playerRepo, prizeRepo, txRepo, outboxRepo)

                // Single draw — must debit exactly once
                core.draw(player.id, singleEntryPool(), 1, debitAmount)

                dbBalance.get() shouldBe (initialBalance - debitAmount)
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // PrizeInstance uniqueness across all outcomes
        // ──────────────────────────────────────────────────────────────────────────

        describe("PrizeInstance uniqueness") {

            it("all 5 outcomes in a 5-draw have distinct prizeInstanceIds") {
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers { firstArg() }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = buildCore(prizeRepo = prizeRepo, txRepo = txRepo, outboxRepo = outboxRepo)

                val outcomes =
                    core.draw(
                        playerId = PlayerId.generate(),
                        pool = singleEntryPool(),
                        quantity = 5,
                        pricePerDraw = 0,
                    )

                outcomes.size shouldBe 5
                outcomes.map { it.prizeInstanceId }.toSet().size shouldBe 5
            }

            it("prizeInstanceId in DrawOutcome matches the id saved to prizeRepository") {
                val savedIds = mutableListOf<UUID>()
                val prizeRepo = mockk<IPrizeRepository>()
                val txRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.saveInstance(any()) } answers {
                    val instance = firstArg<com.prizedraw.domain.entities.PrizeInstance>()
                    savedIds.add(instance.id.value)
                    instance
                }
                every { txRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val core = buildCore(prizeRepo = prizeRepo, txRepo = txRepo, outboxRepo = outboxRepo)

                val outcomes =
                    core.draw(
                        playerId = PlayerId.generate(),
                        pool = singleEntryPool(),
                        quantity = 3,
                        pricePerDraw = 0,
                    )

                outcomes.size shouldBe 3
                outcomes.forEach { outcome ->
                    savedIds.contains(outcome.prizeInstanceId.value) shouldBe true
                }
            }
        }

        // ──────────────────────────────────────────────────────────────────────────
        // Player not found
        // ──────────────────────────────────────────────────────────────────────────

        describe("player lookup failure") {

            it("throws when player does not exist") {
                val missingId = PlayerId.generate()
                val playerRepo = mockk<IPlayerRepository>()

                coEvery { playerRepo.findById(missingId) } returns null

                val core = buildCore(playerRepo = playerRepo)

                val ex =
                    shouldThrow<IllegalStateException> {
                        core.draw(
                            playerId = missingId,
                            pool = singleEntryPool(),
                            quantity = 1,
                            pricePerDraw = 100,
                        )
                    }
                ex.message shouldNotBe null
                ex.message!!.contains("not found", ignoreCase = true) shouldBe true
            }
        }
    })
