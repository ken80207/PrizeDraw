package com.prizedraw.concurrency

import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPaymentGateway
import com.prizedraw.application.ports.output.IPaymentOrderRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.PaymentWebhookResult
import com.prizedraw.application.usecases.payment.ConfirmPaymentWebhookUseCase
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.contracts.enums.PaymentGateway
import com.prizedraw.contracts.enums.PaymentOrderStatus
import com.prizedraw.domain.entities.PaymentOrder
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.testutil.TransactionTestHelper
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
import kotlinx.serialization.json.buildJsonObject
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/**
 * Idempotency tests for [ConfirmPaymentWebhookUseCase].
 *
 * Key invariants verified:
 *  - A duplicate webhook (same gatewayTransactionId) credits points exactly once.
 *  - Two concurrent webhooks for the same order result in exactly one credit.
 *  - An already-PAID order is detected at the status guard and skipped without error.
 *  - An invalid webhook signature is rejected before any database access.
 *
 * Race condition: without the PAID status guard inside the DB transaction, two
 * concurrent webhooks could both read status=PENDING, both attempt to credit points,
 * and double-credit the player. The guard on line 79 of ConfirmPaymentWebhookUseCase
 * (`if (order.status == PaymentOrderStatus.PAID) return`) is the critical protection.
 * These tests verify it functions correctly.
 */
class PaymentIdempotencyTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makePlayer(
            id: PlayerId = PlayerId.generate(),
            drawBalance: Int = 0,
            version: Int = 0,
        ) = Player(
            id = id,
            nickname = "PaymentPlayer",
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

        fun makePendingOrder(
            playerId: PlayerId,
            gatewayTxnId: String,
            pointsGranted: Int = 500,
        ) = PaymentOrder(
            id = UUID.randomUUID(),
            playerId = playerId,
            fiatAmount = 50_000,
            currencyCode = "TWD",
            drawPointsGranted = pointsGranted,
            gateway = PaymentGateway.ECPAY,
            gatewayTransactionId = gatewayTxnId,
            paymentMethod = "credit_card",
            gatewayMetadata = buildJsonObject {},
            status = PaymentOrderStatus.PENDING,
            paidAt = null,
            failedAt = null,
            refundedAt = null,
            expiresAt = null,
            createdAt = now,
            updatedAt = now,
        )

        beforeSpec { TransactionTestHelper.mockTransactions() }

        afterSpec { TransactionTestHelper.unmockTransactions() }

        beforeEach { TransactionTestHelper.stubTransaction() }

        afterEach { clearAllMocks() }

        describe("Payment webhook idempotency") {

            it("duplicate sequential webhook does not double-credit — PAID guard is the protector") {
                // First webhook: order is PENDING → processes and marks PAID.
                // Second webhook: order is now PAID → idempotently skipped.
                val playerId = PlayerId.generate()
                val gatewayTxnId = "TXN-${UUID.randomUUID()}"
                val order = makePendingOrder(playerId, gatewayTxnId, pointsGranted = 500)
                val player = makePlayer(id = playerId, drawBalance = 0)

                val orderStatusRef = AtomicReference(PaymentOrderStatus.PENDING)

                val paymentGateway = mockk<IPaymentGateway>()
                val orderRepo = mockk<IPaymentOrderRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { paymentGateway.verifyWebhook(any(), any()) } returns
                    PaymentWebhookResult(
                        isValid = true,
                        gatewayTransactionId = gatewayTxnId,
                        isPaid = true,
                        isFailed = false,
                    )

                // Order lookup returns PENDING first time, then PAID after save
                coEvery { orderRepo.findByGatewayTransactionId(gatewayTxnId) } answers {
                    order.copy(status = orderStatusRef.get())
                }

                coEvery { orderRepo.save(any()) } answers {
                    val saved = firstArg<PaymentOrder>()
                    orderStatusRef.set(saved.status) // Simulate DB persistence
                    saved
                }

                coEvery { playerRepo.findById(playerId) } returns player
                coEvery { playerRepo.updateBalance(playerId, any(), any(), any()) } returns true
                coEvery { drawPointTxRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val useCase =
                    ConfirmPaymentWebhookUseCase(
                        paymentOrderRepository = orderRepo,
                        playerRepository = playerRepo,
                        drawPointTransactionRepository = drawPointTxRepo,
                        outboxRepository = outboxRepo,
                        paymentGateway = paymentGateway,
                    )

                // First webhook processes successfully
                useCase.execute(PaymentGateway.ECPAY, "payload", "sig")

                // Second webhook: order is now PAID — must be a no-op
                useCase.execute(PaymentGateway.ECPAY, "payload", "sig")

                // Balance credited exactly once (not twice)
                coVerify(exactly = 1) { playerRepo.updateBalance(playerId, 500, 0, any()) }
                coVerify(exactly = 1) { drawPointTxRepo.record(any()) }
                coVerify(exactly = 1) { outboxRepo.enqueue(any()) }
            }

            it("concurrent webhooks for the same order — only one credits points") {
                // Two webhook deliveries arrive simultaneously (parallel coroutines).
                // The PAID status guard inside the DB transaction ensures at most one credits.
                val playerId = PlayerId.generate()
                val gatewayTxnId = "TXN-CONCURRENT-${UUID.randomUUID()}"
                val order = makePendingOrder(playerId, gatewayTxnId, pointsGranted = 500)
                val player = makePlayer(id = playerId, drawBalance = 0)

                // Simulate optimistic: first call sets PAID, second call sees PAID
                val orderStatusRef = AtomicReference(PaymentOrderStatus.PENDING)

                val paymentGateway = mockk<IPaymentGateway>()
                val orderRepo = mockk<IPaymentOrderRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { paymentGateway.verifyWebhook(any(), any()) } returns
                    PaymentWebhookResult(
                        isValid = true,
                        gatewayTransactionId = gatewayTxnId,
                        isPaid = true,
                        isFailed = false,
                    )

                // Simulate serialised DB transaction: first finds PENDING, second finds PAID
                coEvery { orderRepo.findByGatewayTransactionId(gatewayTxnId) } answers {
                    order.copy(status = orderStatusRef.get())
                }

                coEvery { orderRepo.save(any()) } answers {
                    val saved = firstArg<PaymentOrder>()
                    // First save sets PAID; concurrent second save would also set PAID (safe for status)
                    orderStatusRef.compareAndSet(PaymentOrderStatus.PENDING, saved.status)
                    saved
                }

                coEvery { playerRepo.findById(playerId) } returns player

                // Balance update: only one concurrent call should succeed (simulate CAS)
                val balanceUpdated = AtomicInteger(0)
                coEvery { playerRepo.updateBalance(playerId, any(), any(), any()) } answers {
                    // Only the first call wins
                    balanceUpdated.getAndIncrement() == 0
                }

                coEvery { drawPointTxRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val useCase =
                    ConfirmPaymentWebhookUseCase(
                        paymentOrderRepository = orderRepo,
                        playerRepository = playerRepo,
                        drawPointTransactionRepository = drawPointTxRepo,
                        outboxRepository = outboxRepo,
                        paymentGateway = paymentGateway,
                    )

                // Launch both webhooks concurrently
                coroutineScope {
                    listOf(
                        async { useCase.execute(PaymentGateway.ECPAY, "payload", "sig") },
                        async { useCase.execute(PaymentGateway.ECPAY, "payload", "sig") },
                    ).awaitAll()
                }

                // updateBalance called at most once because the status guard exits early
                // OR the concurrent update is idempotent. Either way, points not doubled.
                val updateCalls = balanceUpdated.get()
                updateCalls shouldBe 1
            }

            it("already-PAID order is a complete no-op — no balance update, no ledger entry") {
                val playerId = PlayerId.generate()
                val gatewayTxnId = "TXN-ALREADY-PAID"
                val paidOrder =
                    makePendingOrder(playerId, gatewayTxnId, 500)
                        .copy(status = PaymentOrderStatus.PAID, paidAt = now)

                val paymentGateway = mockk<IPaymentGateway>()
                val orderRepo = mockk<IPaymentOrderRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { paymentGateway.verifyWebhook(any(), any()) } returns
                    PaymentWebhookResult(
                        isValid = true,
                        gatewayTransactionId = gatewayTxnId,
                        isPaid = true,
                        isFailed = false,
                    )

                coEvery { orderRepo.findByGatewayTransactionId(gatewayTxnId) } returns paidOrder

                val useCase =
                    ConfirmPaymentWebhookUseCase(
                        paymentOrderRepository = orderRepo,
                        playerRepository = playerRepo,
                        drawPointTransactionRepository = drawPointTxRepo,
                        outboxRepository = outboxRepo,
                        paymentGateway = paymentGateway,
                    )

                // Must not throw and must not touch the player balance
                useCase.execute(PaymentGateway.ECPAY, "payload", "sig")

                coVerify(exactly = 0) { playerRepo.findById(any()) }
                coVerify(exactly = 0) { playerRepo.updateBalance(any(), any(), any(), any()) }
                coVerify(exactly = 0) { drawPointTxRepo.record(any()) }
                coVerify(exactly = 0) { outboxRepo.enqueue(any()) }
            }

            it("invalid webhook signature is rejected before any DB access") {
                val paymentGateway = mockk<IPaymentGateway>()
                val orderRepo = mockk<IPaymentOrderRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { paymentGateway.verifyWebhook(any(), any()) } returns
                    PaymentWebhookResult(
                        isValid = false,
                        gatewayTransactionId = null,
                        isPaid = false,
                        isFailed = false,
                    )

                val useCase =
                    ConfirmPaymentWebhookUseCase(
                        paymentOrderRepository = orderRepo,
                        playerRepository = playerRepo,
                        drawPointTransactionRepository = drawPointTxRepo,
                        outboxRepository = outboxRepo,
                        paymentGateway = paymentGateway,
                    )

                val thrown =
                    runCatching {
                        useCase.execute(PaymentGateway.ECPAY, "bad payload", "bad sig")
                    }

                thrown.isFailure shouldBe true

                // No DB operations should have been attempted
                coVerify(exactly = 0) { orderRepo.findByGatewayTransactionId(any()) }
                coVerify(exactly = 0) { playerRepo.updateBalance(any(), any(), any(), any()) }
            }

            it("webhook with isPaid=false is silently ignored") {
                val paymentGateway = mockk<IPaymentGateway>()
                val orderRepo = mockk<IPaymentOrderRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { paymentGateway.verifyWebhook(any(), any()) } returns
                    PaymentWebhookResult(
                        isValid = true,
                        gatewayTransactionId = "TXN-PENDING-GATEWAY",
                        isPaid = false, // e.g. a "created" event, not yet paid
                        isFailed = false,
                    )

                val useCase =
                    ConfirmPaymentWebhookUseCase(
                        paymentOrderRepository = orderRepo,
                        playerRepository = playerRepo,
                        drawPointTransactionRepository = drawPointTxRepo,
                        outboxRepository = outboxRepo,
                        paymentGateway = paymentGateway,
                    )

                // Must not throw, must not access DB
                useCase.execute(PaymentGateway.ECPAY, "payload", "sig")

                coVerify(exactly = 0) { orderRepo.findByGatewayTransactionId(any()) }
                coVerify(exactly = 0) { playerRepo.updateBalance(any(), any(), any(), any()) }
            }
        }
    })
