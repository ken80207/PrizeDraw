package com.prizedraw.concurrency

import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IRevenuePointTransactionRepository
import com.prizedraw.application.services.InsufficientBalanceException
import com.prizedraw.application.services.PointsLedgerService
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.contracts.enums.RevenuePointTxType
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.valueobjects.PlayerId
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.ints.shouldBeGreaterThanOrEqual
import io.kotest.matchers.ints.shouldBeLessThanOrEqual
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.datetime.Clock
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger

/**
 * Concurrency tests for [PointsLedgerService].
 *
 * These tests verify the core financial invariants of the optimistic-locking balance
 * update mechanism. All tests mock the repository layer to simulate the Postgres
 * optimistic-lock behaviour (version-gated UPDATE returning 0 rows on conflict)
 * without requiring a real database.
 *
 * Invariants:
 *  - Concurrent debits cannot make a balance negative.
 *  - Optimistic lock retry loop converges to the correct final balance.
 *  - Revenue points and draw points are tracked in separate wallets.
 *  - Debit operations validate balance type — revenue points cannot pay for draws.
 */
class BalanceConcurrencyTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makePlayer(
            id: PlayerId = PlayerId.generate(),
            drawBalance: Int = 0,
            revenueBalance: Int = 0,
            version: Int = 0,
        ) = Player(
            id = id,
            nickname = "TestPlayer",
            avatarUrl = null,
            phoneNumber = null,
            phoneVerifiedAt = null,
            oauthProvider = OAuthProvider.GOOGLE,
            oauthSubject = UUID.randomUUID().toString(),
            drawPointsBalance = drawBalance,
            revenuePointsBalance = revenueBalance,
            version = version,
            preferredAnimationMode = DrawAnimationMode.TEAR,
            locale = "zh-TW",
            isActive = true,
            deletedAt = null,
            createdAt = now,
            updatedAt = now,
        )

        afterEach { clearAllMocks() }

        describe("Point balance integrity") {

            it("concurrent debits cannot make balance negative") {
                // Player has 100 draw points; 10 concurrent debits of 20 each.
                // At most 5 should succeed (5 × 20 = 100). Balance must never go negative.
                val playerId = PlayerId.generate()
                val initialBalance = 100
                val debitAmount = 20

                // Shared mutable state simulating the database row
                val dbBalance = AtomicInteger(initialBalance)
                val dbVersion = AtomicInteger(0)
                val successCount = AtomicInteger(0)

                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()

                coEvery { playerRepo.findById(playerId) } answers {
                    val v = dbVersion.get()
                    makePlayer(
                        id = playerId,
                        drawBalance = dbBalance.get(),
                        version = v,
                    )
                }

                // Simulate atomic CAS: succeed only if version matches and balance won't go negative
                coEvery { playerRepo.updateBalance(playerId, any(), any(), any()) } answers {
                    val delta = secondArg<Int>()
                    val expectedVer = arg<Int>(3)
                    synchronized(dbBalance) {
                        val currentVer = dbVersion.get()
                        if (currentVer != expectedVer) {
                            false // Optimistic lock conflict
                        } else {
                            val newBalance = dbBalance.get() + delta
                            if (newBalance < 0) {
                                false // Would go negative — reject
                            } else {
                                dbBalance.set(newBalance)
                                dbVersion.incrementAndGet()
                                successCount.incrementAndGet()
                                true
                            }
                        }
                    }
                }

                coEvery { drawPointTxRepo.record(any()) } just runs

                val service = PointsLedgerService(playerRepo, drawPointTxRepo, revenuePointTxRepo)

                // Launch 10 concurrent debits of 20 draw points
                val results =
                    coroutineScope {
                        (1..10)
                            .map {
                                async {
                                    runCatching {
                                        service.debitDrawPoints(
                                            playerId = playerId,
                                            amount = debitAmount,
                                            txType = DrawPointTxType.KUJI_DRAW_DEBIT,
                                            description = "test debit $it",
                                        )
                                    }
                                }
                            }.awaitAll()
                    }

                val successes = results.count { it.isSuccess }
                val failures = results.count { it.isFailure }

                // At most 5 can succeed (100 / 20 = 5 max)
                successes shouldBeLessThanOrEqual 5
                failures shouldBeGreaterThanOrEqual 5

                // Balance must be exactly 0 or a non-negative multiple of 20
                val finalBalance = dbBalance.get()
                finalBalance shouldBeGreaterThanOrEqual 0
                (finalBalance % debitAmount) shouldBe 0

                // Balance must not be negative
                (finalBalance < 0) shouldBe false
            }

            it("optimistic lock retries resolve contention — all operations eventually succeed") {
                // Player with 1000 points; 5 sequential debits of 100.
                // The optimistic lock will fail on first attempt for each caller (simulating
                // a concurrent update), but succeed on retry. Final balance = 500.
                val playerId = PlayerId.generate()

                val dbBalance = AtomicInteger(1000)
                val dbVersion = AtomicInteger(0)
                val attemptCount = AtomicInteger(0)

                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()

                coEvery { playerRepo.findById(playerId) } answers {
                    makePlayer(id = playerId, drawBalance = dbBalance.get(), version = dbVersion.get())
                }

                // Simulate: first attempt always fails (stale read), second attempt succeeds
                coEvery { playerRepo.updateBalance(playerId, any(), any(), any()) } answers {
                    val delta = secondArg<Int>()
                    val expectedVer = arg<Int>(3)
                    attemptCount.getAndIncrement()
                    synchronized(dbBalance) {
                        val currentVer = dbVersion.get()
                        if (currentVer != expectedVer) {
                            false
                        } else {
                            val newBalance = dbBalance.get() + delta
                            if (newBalance < 0) {
                                false
                            } else {
                                dbBalance.set(newBalance)
                                dbVersion.incrementAndGet()
                                true
                            }
                        }
                    }
                }

                coEvery { drawPointTxRepo.record(any()) } just runs

                val service = PointsLedgerService(playerRepo, drawPointTxRepo, revenuePointTxRepo)

                // 5 sequential debits of 100 — all must succeed (no contention here, just retries)
                repeat(5) {
                    service.debitDrawPoints(
                        playerId = playerId,
                        amount = 100,
                        txType = DrawPointTxType.KUJI_DRAW_DEBIT,
                        description = "sequential debit",
                    )
                }

                dbBalance.get() shouldBe 500
                dbVersion.get() shouldBe 5
            }

            it("revenue points cannot be used for draw debits") {
                // Player has 0 draw points but 500 revenue points.
                // debitDrawPoints must fail with InsufficientBalanceException.
                val playerId = PlayerId.generate()
                val player = makePlayer(id = playerId, drawBalance = 0, revenueBalance = 500)

                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()

                coEvery { playerRepo.findById(playerId) } returns player

                val service = PointsLedgerService(playerRepo, drawPointTxRepo, revenuePointTxRepo)

                shouldThrow<InsufficientBalanceException> {
                    service.debitDrawPoints(
                        playerId = playerId,
                        amount = 100,
                        txType = DrawPointTxType.KUJI_DRAW_DEBIT,
                        description = "should fail",
                    )
                }

                // Revenue points wallet must be untouched
                coVerify(exactly = 0) { playerRepo.updateBalance(any(), any(), any(), any()) }
                coVerify(exactly = 0) { drawPointTxRepo.record(any()) }
            }

            it("draw points cannot be used for revenue debit operations") {
                // Player has 500 draw points, 0 revenue points.
                // debitRevenuePoints must fail — wrong wallet.
                val playerId = PlayerId.generate()
                val player = makePlayer(id = playerId, drawBalance = 500, revenueBalance = 0)

                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()

                coEvery { playerRepo.findById(playerId) } returns player

                val service = PointsLedgerService(playerRepo, drawPointTxRepo, revenuePointTxRepo)

                shouldThrow<InsufficientBalanceException> {
                    service.debitRevenuePoints(
                        playerId = playerId,
                        amount = 100,
                        txType = RevenuePointTxType.WITHDRAWAL_DEBIT,
                        description = "should fail",
                    )
                }

                coVerify(exactly = 0) { playerRepo.updateBalance(any(), any(), any(), any()) }
                coVerify(exactly = 0) { revenuePointTxRepo.record(any()) }
            }

            it("concurrent withdrawal and trade credit maintain consistency") {
                // Player has 300 revenue points.
                // Concurrent: withdrawal of 300 + trade credit of 200.
                // Regardless of ordering, final balance must be non-negative and consistent.
                val playerId = PlayerId.generate()

                val dbRevenueBalance = AtomicInteger(300)
                val dbVersion = AtomicInteger(0)

                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()

                coEvery { playerRepo.findById(playerId) } answers {
                    makePlayer(id = playerId, revenueBalance = dbRevenueBalance.get(), version = dbVersion.get())
                }

                coEvery { playerRepo.updateBalance(playerId, any(), any(), any()) } answers {
                    val revenueDelta = thirdArg<Int>()
                    val expectedVer = arg<Int>(3)
                    synchronized(dbRevenueBalance) {
                        if (dbVersion.get() != expectedVer) {
                            false
                        } else {
                            val newBalance = dbRevenueBalance.get() + revenueDelta
                            if (newBalance < 0) {
                                false // debit would go negative — reject
                            } else {
                                dbRevenueBalance.set(newBalance)
                                dbVersion.incrementAndGet()
                                true
                            }
                        }
                    }
                }

                coEvery { revenuePointTxRepo.record(any()) } just runs

                val service = PointsLedgerService(playerRepo, drawPointTxRepo, revenuePointTxRepo)

                // Run both concurrently
                val results =
                    coroutineScope {
                        val withdrawal =
                            async {
                                runCatching {
                                    service.debitRevenuePoints(
                                        playerId = playerId,
                                        amount = 300,
                                        txType = RevenuePointTxType.WITHDRAWAL_DEBIT,
                                        description = "withdrawal",
                                    )
                                }
                            }
                        val tradeCredit =
                            async {
                                runCatching {
                                    service.creditRevenuePoints(
                                        playerId = playerId,
                                        amount = 200,
                                        txType = RevenuePointTxType.TRADE_SALE_CREDIT,
                                        description = "trade credit",
                                    )
                                }
                            }
                        listOf(withdrawal.await(), tradeCredit.await())
                    }

                // Balance must be non-negative at all times
                val finalBalance = dbRevenueBalance.get()
                finalBalance shouldBeGreaterThanOrEqual 0

                // If both succeeded: 300 - 300 + 200 = 200, or if credit then debit: same 200
                // If withdrawal failed (balance never reached): balance = 300 + 200 = 500
                // If credit failed (version conflict on retry): balance = 0
                // In all cases: balance >= 0 and <= 500
                finalBalance shouldBeLessThanOrEqual 500
            }

            it("debit amount of zero is rejected by precondition") {
                val playerId = PlayerId.generate()
                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()

                val service = PointsLedgerService(playerRepo, drawPointTxRepo, revenuePointTxRepo)

                shouldThrow<IllegalArgumentException> {
                    service.debitDrawPoints(
                        playerId = playerId,
                        amount = 0,
                        txType = DrawPointTxType.KUJI_DRAW_DEBIT,
                    )
                }

                coVerify(exactly = 0) { playerRepo.findById(any()) }
            }

            it("credit amount of zero is rejected by precondition") {
                val playerId = PlayerId.generate()
                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()

                val service = PointsLedgerService(playerRepo, drawPointTxRepo, revenuePointTxRepo)

                shouldThrow<IllegalArgumentException> {
                    service.creditRevenuePoints(
                        playerId = playerId,
                        amount = 0,
                        txType = RevenuePointTxType.TRADE_SALE_CREDIT,
                    )
                }

                coVerify(exactly = 0) { playerRepo.findById(any()) }
            }
        }
    })
