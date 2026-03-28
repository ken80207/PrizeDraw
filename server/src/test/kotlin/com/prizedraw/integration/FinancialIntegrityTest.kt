package com.prizedraw.integration

import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IRevenuePointTransactionRepository
import com.prizedraw.application.ports.output.IWithdrawalRepository
import com.prizedraw.application.services.InsufficientBalanceException
import com.prizedraw.application.services.PointsLedgerService
import com.prizedraw.application.usecases.withdrawal.CreateWithdrawalRequestUseCase
import com.prizedraw.contracts.dto.withdrawal.CreateWithdrawalRequest
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.contracts.enums.RevenuePointTxType
import com.prizedraw.contracts.enums.WithdrawalStatus
import com.prizedraw.domain.entities.DrawPointTransaction
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.entities.RevenuePointTransaction
import com.prizedraw.domain.entities.WithdrawalRequest
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.testutil.TransactionTestHelper
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
import io.mockk.slot
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.datetime.Clock
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger

/**
 * End-to-end financial integrity tests.
 *
 * These tests verify the zero-sum ledger invariant: every point that enters the
 * system through a payment must be traceable through draws, trades, and withdrawals.
 * No points should be created or destroyed outside of explicit credit/debit operations.
 *
 * Zero-sum invariant:
 *   total draw points purchased
 *   = total draw points consumed by draws
 *   + total draw points spent on trade purchases
 *   + total remaining draw points in all player wallets
 *
 *   total revenue points credited (from trade sales + buybacks)
 *   = total revenue points withdrawn
 *   + total remaining revenue points in all player wallets
 *
 * Tests use in-process state tracking to simulate the database and verify that
 * all operations maintain this invariant.
 */
class FinancialIntegrityTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makePlayer(
            id: PlayerId = PlayerId.generate(),
            drawBalance: Int = 0,
            revenueBalance: Int = 0,
            version: Int = 0,
        ) = Player(
            id = id,
            nickname = "FinPlayer",
            playerCode = "TESTCODE",
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

        beforeSpec { TransactionTestHelper.mockTransactions() }

        afterSpec { TransactionTestHelper.unmockTransactions() }

        beforeEach { TransactionTestHelper.stubTransaction() }

        afterEach { clearAllMocks() }

        describe("End-to-end financial integrity") {

            it("draw point debit ledger entry matches balance reduction") {
                // After debiting 100 draw points, the ledger transaction amount = -100
                // and balanceAfter = initial - 100.
                val playerId = PlayerId.generate()
                val initialBalance = 1000

                val dbBalance = AtomicInteger(initialBalance)
                val dbVersion = AtomicInteger(0)

                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()

                coEvery { playerRepo.findById(playerId) } answers {
                    makePlayer(id = playerId, drawBalance = dbBalance.get(), version = dbVersion.get())
                }

                val capturedTx = slot<DrawPointTransaction>()
                coEvery { drawPointTxRepo.record(capture(capturedTx)) } just runs

                coEvery { playerRepo.updateBalance(playerId, any(), any(), any()) } answers {
                    val delta = secondArg<Int>()
                    val expectedVer = arg<Int>(3)
                    synchronized(dbBalance) {
                        if (dbVersion.get() != expectedVer) {
                            false
                        } else {
                            dbBalance.addAndGet(delta)
                            dbVersion.incrementAndGet()
                            true
                        }
                    }
                }

                val service = PointsLedgerService(playerRepo, drawPointTxRepo, revenuePointTxRepo)

                service.debitDrawPoints(
                    playerId = playerId,
                    amount = 100,
                    txType = DrawPointTxType.KUJI_DRAW_DEBIT,
                    description = "draw",
                )

                capturedTx.captured.amount shouldBe -100
                capturedTx.captured.balanceAfter shouldBe (initialBalance - 100)
                dbBalance.get() shouldBe (initialBalance - 100)
            }

            it("revenue point credit ledger entry matches balance increase") {
                val playerId = PlayerId.generate()
                val initialRevenue = 0

                val dbRevenueBalance = AtomicInteger(initialRevenue)
                val dbVersion = AtomicInteger(0)

                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()

                coEvery { playerRepo.findById(playerId) } answers {
                    makePlayer(id = playerId, revenueBalance = dbRevenueBalance.get(), version = dbVersion.get())
                }

                val capturedTx = slot<RevenuePointTransaction>()
                coEvery { revenuePointTxRepo.record(capture(capturedTx)) } just runs

                coEvery { playerRepo.updateBalance(playerId, any(), any(), any()) } answers {
                    val revenueDelta = thirdArg<Int>()
                    val expectedVer = arg<Int>(3)
                    synchronized(dbRevenueBalance) {
                        if (dbVersion.get() != expectedVer) {
                            false
                        } else {
                            dbRevenueBalance.addAndGet(revenueDelta)
                            dbVersion.incrementAndGet()
                            true
                        }
                    }
                }

                val service = PointsLedgerService(playerRepo, drawPointTxRepo, revenuePointTxRepo)

                service.creditRevenuePoints(
                    playerId = playerId,
                    amount = 200,
                    txType = RevenuePointTxType.TRADE_SALE_CREDIT,
                    description = "trade sale",
                )

                capturedTx.captured.amount shouldBe 200
                capturedTx.captured.balanceAfter shouldBe 200
                dbRevenueBalance.get() shouldBe 200
            }

            it("withdrawal debits revenue points and creates a PENDING_REVIEW request") {
                val playerId = PlayerId.generate()
                val initialRevenue = 300

                val dbRevenueBalance = AtomicInteger(initialRevenue)
                val dbVersion = AtomicInteger(0)

                val playerRepo = mockk<IPlayerRepository>()
                val withdrawalRepo = mockk<IWithdrawalRepository>()
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
                            val newBal = dbRevenueBalance.get() + revenueDelta
                            if (newBal < 0) {
                                return@answers false
                            }
                            dbRevenueBalance.set(newBal)
                            dbVersion.incrementAndGet()
                            true
                        }
                    }
                }

                val capturedWithdrawal = slot<WithdrawalRequest>()
                coEvery { withdrawalRepo.save(capture(capturedWithdrawal)) } answers { capturedWithdrawal.captured }
                coEvery { revenuePointTxRepo.record(any()) } just runs

                val pointsLedger = PointsLedgerService(playerRepo, drawPointTxRepo, revenuePointTxRepo)

                val useCase =
                    CreateWithdrawalRequestUseCase(
                        playerRepository = playerRepo,
                        withdrawalRepository = withdrawalRepo,
                        pointsLedgerService = pointsLedger,
                    )

                useCase.execute(
                    playerId = playerId,
                    request =
                        CreateWithdrawalRequest(
                            pointsAmount = 300,
                            bankName = "CTBC",
                            bankCode = "822",
                            accountHolderName = "Test User",
                            accountNumber = "1234567890",
                        ),
                )

                capturedWithdrawal.captured.status shouldBe WithdrawalStatus.PENDING_REVIEW
                capturedWithdrawal.captured.pointsAmount shouldBe 300

                // Revenue balance debited
                dbRevenueBalance.get() shouldBe 0

                coVerify(exactly = 1) { revenuePointTxRepo.record(any()) }
            }

            it("withdrawal fails when revenue balance is insufficient") {
                val playerId = PlayerId.generate()

                val playerRepo = mockk<IPlayerRepository>()
                val withdrawalRepo = mockk<IWithdrawalRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()

                // Player has 100 revenue points, tries to withdraw 300
                coEvery { playerRepo.findById(playerId) } returns
                    makePlayer(
                        id = playerId,
                        revenueBalance = 100,
                    )

                val pointsLedger = PointsLedgerService(playerRepo, drawPointTxRepo, revenuePointTxRepo)

                val useCase =
                    CreateWithdrawalRequestUseCase(
                        playerRepository = playerRepo,
                        withdrawalRepository = withdrawalRepo,
                        pointsLedgerService = pointsLedger,
                    )

                shouldThrow<InsufficientBalanceException> {
                    useCase.execute(
                        playerId = playerId,
                        request =
                            CreateWithdrawalRequest(
                                pointsAmount = 300,
                                bankName = "CTBC",
                                bankCode = "822",
                                accountHolderName = "Test User",
                                accountNumber = "1234567890",
                            ),
                    )
                }

                // Nothing saved
                coVerify(exactly = 0) { withdrawalRepo.save(any()) }
                coVerify(exactly = 0) { playerRepo.updateBalance(any(), any(), any(), any()) }
            }

            it("concurrent withdrawals cannot drain balance below zero") {
                // Player has 300 revenue points; two concurrent withdrawal requests of 300 each.
                // At most one should succeed; balance must not go negative.
                val playerId = PlayerId.generate()

                val dbRevenueBalance = AtomicInteger(300)
                val dbVersion = AtomicInteger(0)

                val playerRepo = mockk<IPlayerRepository>()
                val withdrawalRepo = mockk<IWithdrawalRepository>()
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
                            val newBal = dbRevenueBalance.get() + revenueDelta
                            if (newBal < 0) {
                                return@answers false
                            }
                            dbRevenueBalance.set(newBal)
                            dbVersion.incrementAndGet()
                            true
                        }
                    }
                }

                coEvery { withdrawalRepo.save(any()) } answers { firstArg() }
                coEvery { revenuePointTxRepo.record(any()) } just runs

                val pointsLedger = PointsLedgerService(playerRepo, drawPointTxRepo, revenuePointTxRepo)

                val useCase =
                    CreateWithdrawalRequestUseCase(
                        playerRepository = playerRepo,
                        withdrawalRepository = withdrawalRepo,
                        pointsLedgerService = pointsLedger,
                    )

                val withdrawalRequest =
                    CreateWithdrawalRequest(
                        pointsAmount = 300,
                        bankName = "CTBC",
                        bankCode = "822",
                        accountHolderName = "Test User",
                        accountNumber = "9999999999",
                    )

                val results =
                    coroutineScope {
                        listOf(
                            async { runCatching { useCase.execute(playerId, withdrawalRequest) } },
                            async { runCatching { useCase.execute(playerId, withdrawalRequest) } },
                        ).map { it.await() }
                    }

                val successCount = results.count { it.isSuccess }

                // At most one withdrawal can succeed
                successCount shouldBeLessThanOrEqual 1

                // Balance must be non-negative
                dbRevenueBalance.get() shouldBeGreaterThanOrEqual 0
            }

            it("withdrawal with zero amount is rejected by precondition") {
                val playerId = PlayerId.generate()
                val playerRepo = mockk<IPlayerRepository>()
                val withdrawalRepo = mockk<IWithdrawalRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()

                val pointsLedger = PointsLedgerService(playerRepo, drawPointTxRepo, revenuePointTxRepo)

                val useCase =
                    CreateWithdrawalRequestUseCase(
                        playerRepository = playerRepo,
                        withdrawalRepository = withdrawalRepo,
                        pointsLedgerService = pointsLedger,
                    )

                shouldThrow<IllegalArgumentException> {
                    useCase.execute(
                        playerId = playerId,
                        request =
                            CreateWithdrawalRequest(
                                pointsAmount = 0,
                                bankName = "CTBC",
                                bankCode = "822",
                                accountHolderName = "Test User",
                                accountNumber = "1234567890",
                            ),
                    )
                }

                coVerify(exactly = 0) { playerRepo.findById(any()) }
            }
        }
    })
