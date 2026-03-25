package com.prizedraw.concurrency

import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IBuybackRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IRevenuePointTransactionRepository
import com.prizedraw.application.ports.output.IShippingRepository
import com.prizedraw.application.usecases.buyback.BuybackUseCase
import com.prizedraw.application.usecases.buyback.PrizeNotAvailableForBuybackException
import com.prizedraw.application.usecases.shipping.CreateShippingOrderUseCase
import com.prizedraw.application.usecases.shipping.PrizeNotHoldingException
import com.prizedraw.contracts.dto.shipping.CreateShippingOrderRequest
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.entities.PrizeAcquisitionMethod
import com.prizedraw.domain.entities.PrizeInstance
import com.prizedraw.domain.entities.ShippingOrder
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
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
import kotlinx.datetime.Clock
import java.util.UUID
import java.util.concurrent.atomic.AtomicReference

/**
 * Prize state mutual exclusion tests.
 *
 * The PrizeInstance state machine enforces that only one operation can claim a
 * HOLDING prize at a time. The `updateInstanceState(id, newState, expectedState=HOLDING)`
 * call is the gatekeeper: it performs an atomic conditional UPDATE in the DB
 * (`UPDATE ... WHERE state = 'HOLDING'`) and returns false if the prize was already
 * claimed by another operation.
 *
 * Operations that transition from HOLDING:
 *  - Trade listing creation    → TRADING
 *  - Shipping order creation   → PENDING_SHIPMENT
 *  - Buyback                   → RECYCLED
 *  - Exchange request creation → EXCHANGING
 *
 * These tests verify that when two operations race on the same prize, exactly one
 * wins and the other is rejected cleanly.
 */
class PrizeStateMutexTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makePlayer(id: PlayerId = PlayerId.generate()) =
            Player(
                id = id,
                nickname = "PrizeOwner",
                avatarUrl = null,
                phoneNumber = null,
                phoneVerifiedAt = null,
                oauthProvider = OAuthProvider.GOOGLE,
                oauthSubject = UUID.randomUUID().toString(),
                drawPointsBalance = 0,
                revenuePointsBalance = 0,
                version = 0,
                preferredAnimationMode = DrawAnimationMode.TEAR,
                locale = "zh-TW",
                isActive = true,
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
            )

        fun makeHoldingInstance(
            id: PrizeInstanceId = PrizeInstanceId.generate(),
            ownerId: PlayerId,
        ) = PrizeInstance(
            id = id,
            prizeDefinitionId = PrizeDefinitionId.generate(),
            ownerId = ownerId,
            acquisitionMethod = PrizeAcquisitionMethod.KUJI_DRAW,
            sourceDrawTicketId = null,
            sourceTradeOrderId = null,
            sourceExchangeRequestId = null,
            state = PrizeState.HOLDING,
            acquiredAt = now,
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

        afterEach {
            clearAllMocks()
        }

        describe("Prize state mutual exclusion") {

            it("prize cannot be shipped if it is already in TRADING state") {
                // Prize was claimed by a trade listing. Shipping must fail.
                val player = makePlayer()
                val prizeId = PrizeInstanceId.generate()
                val tradingInstance = makeHoldingInstance(prizeId, player.id).copy(state = PrizeState.TRADING)

                val prizeRepo = mockk<IPrizeRepository>()
                val shippingRepo = mockk<IShippingRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                // Prize is already TRADING — not HOLDING
                coEvery { prizeRepo.findInstanceById(prizeId) } returns tradingInstance

                val useCase =
                    CreateShippingOrderUseCase(
                        prizeRepository = prizeRepo,
                        shippingRepository = shippingRepo,
                        outboxRepository = outboxRepo,
                    )

                shouldThrow<PrizeNotHoldingException> {
                    useCase.execute(
                        playerId = player.id,
                        request =
                            CreateShippingOrderRequest(
                                prizeInstanceId = prizeId.value.toString(),
                                recipientName = "Test User",
                                recipientPhone = "+886912345678",
                                addressLine1 = "123 Test St",
                                addressLine2 = null,
                                city = "Taipei",
                                postalCode = "10001",
                                countryCode = "TW",
                            ),
                    )
                }

                coVerify(exactly = 0) { shippingRepo.save(any()) }
                coVerify(exactly = 0) { prizeRepo.updateInstanceState(any(), any(), any()) }
            }

            it("prize cannot be recycled (buyback) if it is already in TRADING state") {
                val player = makePlayer()
                val prizeId = PrizeInstanceId.generate()
                val tradingInstance = makeHoldingInstance(prizeId, player.id).copy(state = PrizeState.TRADING)

                val prizeRepo = mockk<IPrizeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val buybackRepo = mockk<IBuybackRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.findInstanceById(prizeId) } returns tradingInstance

                val useCase =
                    BuybackUseCase(
                        prizeRepository = prizeRepo,
                        playerRepository = playerRepo,
                        buybackRepository = buybackRepo,
                        revenuePointTxRepository = revenuePointTxRepo,
                        auditRepository = auditRepo,
                        outboxRepository = outboxRepo,
                    )

                shouldThrow<PrizeNotAvailableForBuybackException> {
                    useCase.execute(playerId = player.id, prizeInstanceId = prizeId)
                }

                coVerify(exactly = 0) { buybackRepo.save(any()) }
                coVerify(exactly = 0) { prizeRepo.updateInstanceState(any(), any(), any()) }
                coVerify(exactly = 0) { playerRepo.updateBalance(any(), any(), any(), any()) }
            }

            it("prize state transition uses expected-state guard — second transition rejected") {
                // Both operations try updateInstanceState(id, TRADING, HOLDING) concurrently.
                // The first wins; the second sees a version/state conflict and must fail or return false.
                val player = makePlayer()
                val prizeId = PrizeInstanceId.generate()
                val holdingInstance = makeHoldingInstance(prizeId, player.id)

                val stateRef = AtomicReference(PrizeState.HOLDING)
                val transitionCount =
                    java.util.concurrent.atomic
                        .AtomicInteger(0)

                val prizeRepo = mockk<IPrizeRepository>()
                val shippingRepo = mockk<IShippingRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                // Prize starts HOLDING
                coEvery { prizeRepo.findInstanceById(prizeId) } answers {
                    holdingInstance.copy(state = stateRef.get())
                }

                // Atomic CAS: only the first call with expectedState=HOLDING succeeds
                coEvery {
                    prizeRepo.updateInstanceState(prizeId, PrizeState.PENDING_SHIPMENT, PrizeState.HOLDING)
                } answers {
                    synchronized(stateRef) {
                        if (stateRef.get() == PrizeState.HOLDING) {
                            stateRef.set(PrizeState.PENDING_SHIPMENT)
                            transitionCount.incrementAndGet()
                            true
                        } else {
                            false
                        }
                    }
                }

                val savedShippingOrder =
                    ShippingOrder(
                        id = UUID.randomUUID(),
                        playerId = player.id,
                        prizeInstanceId = prizeId,
                        recipientName = "Test",
                        recipientPhone = "+886912345678",
                        addressLine1 = "123 St",
                        addressLine2 = null,
                        city = "Taipei",
                        postalCode = "10001",
                        countryCode = "TW",
                        trackingNumber = null,
                        carrier = null,
                        status = com.prizedraw.contracts.enums.ShippingOrderStatus.PENDING_SHIPMENT,
                        shippedAt = null,
                        deliveredAt = null,
                        cancelledAt = null,
                        fulfilledByStaffId = null,
                        createdAt = now,
                        updatedAt = now,
                    )
                coEvery { shippingRepo.save(any()) } returns savedShippingOrder
                every { outboxRepo.enqueue(any()) } just runs

                val useCase =
                    CreateShippingOrderUseCase(
                        prizeRepository = prizeRepo,
                        shippingRepository = shippingRepo,
                        outboxRepository = outboxRepo,
                    )

                val request =
                    CreateShippingOrderRequest(
                        prizeInstanceId = prizeId.value.toString(),
                        recipientName = "Test",
                        recipientPhone = "+886912345678",
                        addressLine1 = "123 St",
                        addressLine2 = null,
                        city = "Taipei",
                        postalCode = "10001",
                        countryCode = "TW",
                    )

                // First call succeeds
                useCase.execute(player.id, request)

                // Second call: prize is now PENDING_SHIPMENT, not HOLDING
                shouldThrow<PrizeNotHoldingException> {
                    useCase.execute(player.id, request)
                }

                // State transition applied exactly once
                transitionCount.get() shouldBe 1
            }

            it("buyback on a HOLDING prize succeeds and transitions to RECYCLED") {
                val player = makePlayer()
                val prizeId = PrizeInstanceId.generate()
                val holdingInstance = makeHoldingInstance(prizeId, player.id)
                val prizeDef =
                    com.prizedraw.domain.entities.PrizeDefinition(
                        id = holdingInstance.prizeDefinitionId,
                        kujiCampaignId =
                            com.prizedraw.domain.valueobjects.CampaignId
                                .generate(),
                        unlimitedCampaignId = null,
                        grade = "A",
                        name = "Test Prize",
                        photos = emptyList(),
                        buybackPrice = 150,
                        buybackEnabled = true,
                        probabilityBps = null,
                        ticketCount = null,
                        displayOrder = 1,
                        createdAt = now,
                        updatedAt = now,
                    )

                val prizeRepo = mockk<IPrizeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val buybackRepo = mockk<IBuybackRepository>()
                val revenuePointTxRepo = mockk<IRevenuePointTransactionRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.findInstanceById(prizeId) } returns holdingInstance
                coEvery { prizeRepo.findDefinitionById(holdingInstance.prizeDefinitionId) } returns prizeDef
                coEvery { prizeRepo.updateInstanceState(prizeId, PrizeState.RECYCLED, PrizeState.HOLDING) } returns true
                coEvery { buybackRepo.save(any()) } answers { firstArg() }
                coEvery { playerRepo.findById(player.id) } returns makePlayer(player.id)
                coEvery { playerRepo.updateBalance(player.id, any(), any(), any()) } returns true
                coEvery { revenuePointTxRepo.record(any()) } just runs
                coEvery { auditRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val useCase =
                    BuybackUseCase(
                        prizeRepository = prizeRepo,
                        playerRepository = playerRepo,
                        buybackRepository = buybackRepo,
                        revenuePointTxRepository = revenuePointTxRepo,
                        auditRepository = auditRepo,
                        outboxRepository = outboxRepo,
                    )

                val price = useCase.execute(playerId = player.id, prizeInstanceId = prizeId)

                price shouldBe 150

                coVerify(
                    exactly = 1
                ) { prizeRepo.updateInstanceState(prizeId, PrizeState.RECYCLED, PrizeState.HOLDING) }
                coVerify(exactly = 1) { playerRepo.updateBalance(player.id, 0, 150, any()) }
            }

            it("shipping creates order and transitions prize to PENDING_SHIPMENT atomically") {
                val player = makePlayer()
                val prizeId = PrizeInstanceId.generate()
                val holdingInstance = makeHoldingInstance(prizeId, player.id)

                val prizeRepo = mockk<IPrizeRepository>()
                val shippingRepo = mockk<IShippingRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { prizeRepo.findInstanceById(prizeId) } returns holdingInstance
                coEvery {
                    prizeRepo.updateInstanceState(prizeId, PrizeState.PENDING_SHIPMENT, PrizeState.HOLDING)
                } returns true

                val shippingOrder =
                    ShippingOrder(
                        id = UUID.randomUUID(),
                        playerId = player.id,
                        prizeInstanceId = prizeId,
                        recipientName = "Receiver",
                        recipientPhone = "+886912345678",
                        addressLine1 = "456 Ave",
                        addressLine2 = null,
                        city = "Taipei",
                        postalCode = "10002",
                        countryCode = "TW",
                        trackingNumber = null,
                        carrier = null,
                        status = com.prizedraw.contracts.enums.ShippingOrderStatus.PENDING_SHIPMENT,
                        shippedAt = null,
                        deliveredAt = null,
                        cancelledAt = null,
                        fulfilledByStaffId = null,
                        createdAt = now,
                        updatedAt = now,
                    )
                coEvery { shippingRepo.save(any()) } returns shippingOrder
                every { outboxRepo.enqueue(any()) } just runs

                val useCase =
                    CreateShippingOrderUseCase(
                        prizeRepository = prizeRepo,
                        shippingRepository = shippingRepo,
                        outboxRepository = outboxRepo,
                    )

                val dto =
                    useCase.execute(
                        playerId = player.id,
                        request =
                            CreateShippingOrderRequest(
                                prizeInstanceId = prizeId.value.toString(),
                                recipientName = "Receiver",
                                recipientPhone = "+886912345678",
                                addressLine1 = "456 Ave",
                                addressLine2 = null,
                                city = "Taipei",
                                postalCode = "10002",
                                countryCode = "TW",
                            ),
                    )

                dto.prizeInstanceId shouldBe prizeId.value.toString()

                coVerify(exactly = 1) { shippingRepo.save(any()) }
                coVerify(exactly = 1) {
                    prizeRepo.updateInstanceState(prizeId, PrizeState.PENDING_SHIPMENT, PrizeState.HOLDING)
                }
            }
        }
    })
