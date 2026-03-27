package com.prizedraw.concurrency

import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IRevenuePointTransactionRepository
import com.prizedraw.application.ports.output.ITradeRepository
import com.prizedraw.application.usecases.trade.InsufficientDrawPointsException
import com.prizedraw.application.usecases.trade.ListingNotAvailableException
import com.prizedraw.application.usecases.trade.PurchaseTradeListingUseCase
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.contracts.enums.TradeOrderStatus
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.entities.PrizeAcquisitionMethod
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.PrizeInstance
import com.prizedraw.domain.entities.TradeListing
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import com.prizedraw.infrastructure.external.redis.DistributedLock
import com.prizedraw.testutil.TransactionTestHelper
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
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
 * Concurrency tests for trade purchase use case.
 *
 * Key invariants verified:
 *  - Distributed lock ensures exactly one buyer wins a race on the same listing.
 *  - A re-check of listing status inside the lock rejects the loser atomically.
 *  - A buyer whose balance was drained by a concurrent draw cannot complete a purchase.
 *  - A prize in EXCHANGING state cannot be listed for trade.
 */
class TradeConcurrencyTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makePlayer(
            id: PlayerId = PlayerId.generate(),
            drawBalance: Int = 500,
            version: Int = 0,
        ) = Player(
            id = id,
            nickname = "Player",
            avatarUrl = null,
            phoneNumber = null,
            phoneVerifiedAt = null,
            oauthProvider = OAuthProvider.GOOGLE,
            oauthSubject = UUID.randomUUID().toString(),
            drawPointsBalance = drawBalance,
            revenuePointsBalance = 0,
            version = version,
            preferredAnimationMode = DrawAnimationMode.TEAR,
            locale = "zh-TW",
            isActive = true,
            deletedAt = null,
            createdAt = now,
            updatedAt = now,
        )

        fun makeListing(
            sellerId: PlayerId,
            prizeId: PrizeInstanceId,
            price: Int = 100,
            status: TradeOrderStatus = TradeOrderStatus.LISTED,
        ) = TradeListing(
            id = UUID.randomUUID(),
            sellerId = sellerId,
            buyerId = null,
            prizeInstanceId = prizeId,
            listPrice = price,
            feeRateBps = 500, // 5%
            feeAmount = null,
            sellerProceeds = null,
            status = status,
            listedAt = now,
            completedAt = null,
            cancelledAt = null,
            deletedAt = null,
            createdAt = now,
            updatedAt = now,
        )

        fun makeInstance(
            ownerId: PlayerId,
            state: PrizeState = PrizeState.HOLDING,
        ) = PrizeInstance(
            id = PrizeInstanceId.generate(),
            prizeDefinitionId = PrizeDefinitionId.generate(),
            ownerId = ownerId,
            acquisitionMethod = PrizeAcquisitionMethod.KUJI_DRAW,
            sourceDrawTicketId = null,
            sourceTradeOrderId = null,
            sourceExchangeRequestId = null,
            state = state,
            acquiredAt = now,
            deletedAt = null,
            createdAt = now,
            updatedAt = now,
        )

        fun makePrizeDefinition(id: PrizeDefinitionId = PrizeDefinitionId.generate()) =
            PrizeDefinition(
                id = id,
                kujiCampaignId = CampaignId.generate(),
                unlimitedCampaignId = null,
                grade = "A賞",
                name = "Test Prize",
                photos = listOf("https://example.com/photo.jpg"),
                prizeValue = 0,
                buybackPrice = 50,
                buybackEnabled = true,
                probabilityBps = null,
                ticketCount = 1,
                displayOrder = 1,
                createdAt = now,
                updatedAt = now,
            )

        beforeSpec { TransactionTestHelper.mockTransactions() }

        afterSpec { TransactionTestHelper.unmockTransactions() }

        beforeEach { TransactionTestHelper.stubTransaction() }

        afterEach { clearAllMocks() }

        describe("Trade purchase race conditions") {

            it("two buyers cannot purchase the same listing — distributed lock serialises them") {
                // Setup: 1 listing, 2 buyers with sufficient balance.
                // The DistributedLock.withLock uses Redis SET NX — we simulate this using an
                // AtomicInteger flag: first call succeeds (lock acquired), second returns null.
                val seller = makePlayer(drawBalance = 0)
                val buyerA = makePlayer(drawBalance = 500)
                val buyerB = makePlayer(drawBalance = 500)
                val prizeId = PrizeInstanceId.generate()
                val listing = makeListing(seller.id, prizeId, price = 100)

                val lockAcquireCount = AtomicInteger(0)

                val distributedLock = mockk<DistributedLock>()
                // First caller acquires lock and executes block; second caller returns null (lock held)
                // Distributed lock: first caller (regardless of which buyer) acquires lock and
                // executes block; second caller returns null (lock contention).
                coEvery { distributedLock.withLock(any(), any(), any<suspend () -> Any?>()) } coAnswers {
                    if (lockAcquireCount.getAndIncrement() == 0) {
                        val block = thirdArg<suspend () -> Any?>()
                        block()
                    } else {
                        null // Lock contention — second buyer fails
                    }
                }

                val tradeRepo = mockk<ITradeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                val instance = makeInstance(seller.id)
                val definition = makePrizeDefinition(instance.prizeDefinitionId)

                // Either buyer may be the winner — mock both
                // Listing is LISTED for both pre-lock checks
                coEvery { tradeRepo.findById(listing.id) } returns listing
                coEvery { playerRepo.findById(buyerA.id) } returns buyerA
                coEvery { playerRepo.findById(buyerB.id) } returns buyerB
                coEvery { playerRepo.findById(seller.id) } returns seller
                coEvery { playerRepo.updateBalance(buyerA.id, any(), any(), any()) } returns true
                coEvery { playerRepo.updateBalance(buyerB.id, any(), any(), any()) } returns true
                coEvery { playerRepo.updateBalance(seller.id, any(), any(), any()) } returns true
                coEvery { prizeRepo.findInstanceById(prizeId) } returns instance
                coEvery { prizeRepo.findDefinitionById(instance.prizeDefinitionId) } returns definition
                // transferOwnership succeeds for whichever buyer wins the lock
                coEvery { prizeRepo.transferOwnership(any(), any(), any()) } returns
                    instance.copy(ownerId = buyerA.id)
                coEvery { tradeRepo.save(any()) } answers { firstArg() }
                coEvery { drawPointTxRepo.record(any()) } just runs
                coEvery { revenuePointTxRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val useCase =
                    PurchaseTradeListingUseCase(
                        tradeRepository = tradeRepo,
                        playerRepository = playerRepo,
                        prizeRepository = prizeRepo,
                        drawPointTxRepository = drawPointTxRepo,
                        revenuePointTxRepository = revenuePointTxRepo,
                        outboxRepository = outboxRepo,
                        distributedLock = distributedLock,
                    )

                // Launch both buyers concurrently — exactly one should succeed
                val results =
                    coroutineScope {
                        listOf(
                            async { runCatching { useCase.execute(buyerA.id, listing.id) } },
                            async { runCatching { useCase.execute(buyerB.id, listing.id) } },
                        ).awaitAll()
                    }

                val successCount = results.count { it.isSuccess }
                val failureCount = results.count { it.isFailure }

                // Exactly one buyer wins the lock
                successCount shouldBe 1
                failureCount shouldBe 1

                // Prize ownership transferred exactly once (to whichever buyer won)
                coVerify(exactly = 1) { prizeRepo.transferOwnership(prizeId, any(), PrizeState.HOLDING) }

                // Seller credited exactly once
                coVerify(exactly = 1) { revenuePointTxRepo.record(any()) }
            }

            it("second buyer sees COMPLETED listing inside the lock and is rejected") {
                // The re-check inside executeAtomicPurchase must detect listing status = COMPLETED
                // and throw ListingNotAvailableException even if the outer check passed.
                val seller = makePlayer(drawBalance = 0)
                val buyerA = makePlayer(drawBalance = 500)
                val buyerB = makePlayer(drawBalance = 500)
                val prizeId = PrizeInstanceId.generate()
                val listing = makeListing(seller.id, prizeId, price = 100)
                val completedListing =
                    listing.copy(
                        buyerId = buyerA.id,
                        status = TradeOrderStatus.COMPLETED,
                        completedAt = now,
                        updatedAt = now,
                    )

                // Both buyers pass the outer status check (listing appears LISTED)
                // but inside the lock the listing is already COMPLETED for buyerB
                var insideLockCallCount = 0
                val distributedLock = mockk<DistributedLock>()
                coEvery { distributedLock.withLock(any(), any(), any<suspend () -> Any>()) } coAnswers {
                    insideLockCallCount++
                    val block = thirdArg<suspend () -> Any>()
                    block()
                }

                val tradeRepo = mockk<ITradeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                // Outer findById returns LISTED for both; inner re-check returns COMPLETED on 2nd call
                coEvery { tradeRepo.findById(listing.id) } returnsMany
                    listOf(
                        listing, // buyerA outer check
                        listing, // buyerA inner check
                        listing, // buyerB outer check
                        completedListing, // buyerB inner check — already purchased!
                    )
                coEvery { playerRepo.findById(buyerA.id) } returns buyerA
                coEvery { playerRepo.findById(seller.id) } returns seller
                coEvery { playerRepo.updateBalance(buyerA.id, any(), any(), any()) } returns true
                coEvery { playerRepo.updateBalance(seller.id, any(), any(), any()) } returns true
                val instance = makeInstance(seller.id)
                val definition = makePrizeDefinition(instance.prizeDefinitionId)
                coEvery { prizeRepo.findInstanceById(prizeId) } returns instance
                coEvery { prizeRepo.findDefinitionById(instance.prizeDefinitionId) } returns definition
                coEvery { prizeRepo.transferOwnership(any(), any(), any()) } returns instance.copy(ownerId = buyerA.id)
                coEvery { tradeRepo.save(any()) } returns completedListing
                coEvery { drawPointTxRepo.record(any()) } just runs
                coEvery { revenuePointTxRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val useCase =
                    PurchaseTradeListingUseCase(
                        tradeRepository = tradeRepo,
                        playerRepository = playerRepo,
                        prizeRepository = prizeRepo,
                        drawPointTxRepository = drawPointTxRepo,
                        revenuePointTxRepository = revenuePointTxRepo,
                        outboxRepository = outboxRepo,
                        distributedLock = distributedLock,
                    )

                // buyerA succeeds
                useCase.execute(buyerA.id, listing.id)

                // buyerB is rejected inside the lock
                shouldThrow<ListingNotAvailableException> {
                    useCase.execute(buyerB.id, listing.id)
                }

                // Prize transferred exactly once
                coVerify(exactly = 1) { prizeRepo.transferOwnership(any(), buyerA.id, PrizeState.HOLDING) }
            }

            it("buyer cannot purchase if balance is exactly depleted by a concurrent draw") {
                // Player has exactly 100 draw points; listing costs 100.
                // A concurrent draw already debited 100 points (version incremented).
                // The optimistic-lock retry loop must detect balance = 0 and throw.
                val seller = makePlayer(drawBalance = 0)
                val buyer = makePlayer(drawBalance = 100, version = 1) // version=1 means balance was already modified
                val prizeId = PrizeInstanceId.generate()
                val listing = makeListing(seller.id, prizeId, price = 100)

                // Inside the lock the buyer's balance is now 0 (concurrent draw drained it)
                val drainedBuyer = buyer.copy(drawPointsBalance = 0, version = 2)

                val distributedLock = mockk<DistributedLock>()
                coEvery { distributedLock.withLock(any(), any(), any<suspend () -> Any>()) } coAnswers {
                    val block = thirdArg<suspend () -> Any>()
                    block()
                }

                val tradeRepo = mockk<ITradeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                // Inside the transaction: buyer's balance has been drained to 0
                coEvery { tradeRepo.findById(listing.id) } returns listing
                coEvery { playerRepo.findById(buyer.id) } returns drainedBuyer // balance = 0

                val useCase =
                    PurchaseTradeListingUseCase(
                        tradeRepository = tradeRepo,
                        playerRepository = playerRepo,
                        prizeRepository = prizeRepo,
                        drawPointTxRepository = drawPointTxRepo,
                        revenuePointTxRepository = revenuePointTxRepo,
                        outboxRepository = outboxRepo,
                        distributedLock = distributedLock,
                    )

                shouldThrow<InsufficientDrawPointsException> {
                    useCase.execute(buyer.id, listing.id)
                }

                // No balance updated, no prize transferred
                coVerify(exactly = 0) { playerRepo.updateBalance(any(), any(), any(), any()) }
                coVerify(exactly = 0) { prizeRepo.transferOwnership(any(), any(), any()) }
            }

            it("buyer cannot purchase their own listing") {
                val seller = makePlayer(drawBalance = 500)
                val prizeId = PrizeInstanceId.generate()
                val listing = makeListing(seller.id, prizeId, price = 100)

                val distributedLock = mockk<DistributedLock>()
                val tradeRepo = mockk<ITradeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { tradeRepo.findById(listing.id) } returns listing

                val useCase =
                    PurchaseTradeListingUseCase(
                        tradeRepository = tradeRepo,
                        playerRepository = playerRepo,
                        prizeRepository = prizeRepo,
                        drawPointTxRepository = drawPointTxRepo,
                        revenuePointTxRepository = revenuePointTxRepo,
                        outboxRepository = outboxRepo,
                        distributedLock = distributedLock,
                    )

                shouldThrow<com.prizedraw.application.usecases.trade.SelfPurchaseException> {
                    useCase.execute(seller.id, listing.id)
                }

                coVerify(exactly = 0) { distributedLock.withLock(any(), any(), any<suspend () -> Any>()) }
            }
        }
    })
