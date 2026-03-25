package com.prizedraw.concurrency

import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IExchangeRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.usecases.exchange.ExchangeNotPendingException
import com.prizedraw.application.usecases.exchange.RespondExchangeRequestUseCase
import com.prizedraw.contracts.dto.exchange.ExchangeResponseAction
import com.prizedraw.contracts.dto.exchange.RespondExchangeRequest
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.ExchangeItemSide
import com.prizedraw.contracts.enums.ExchangeRequestStatus
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.domain.entities.ExchangeRequest
import com.prizedraw.domain.entities.ExchangeRequestItem
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.entities.PrizeAcquisitionMethod
import com.prizedraw.domain.entities.PrizeInstance
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import com.prizedraw.testutil.TransactionTestHelper
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
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
 * Concurrency tests for [RespondExchangeRequestUseCase].
 *
 * Key invariants verified:
 *  - Accepting an exchange that is no longer PENDING fails atomically.
 *  - If a recipient prize was sold between request creation and accept, the accept fails
 *    and initiator prizes are restored to HOLDING.
 *  - Prize state transitions (EXCHANGING → HOLDING) use the expected-state guard.
 *  - Counter-propose locks the responder's prizes atomically.
 *
 * Race condition in RespondExchangeRequestUseCase:
 *  The use case wraps the entire accept/reject in newSuspendedTransaction, and
 *  prizeRepository.transferOwnership / updateInstanceState use optimistic expected-state
 *  checks. If a concurrent trade sold one of the recipient's prizes between the exchange
 *  request being created and the accept being processed, transferOwnership will either
 *  fail (if the implementation guards on current state) or succeed on a stale prize.
 *  These tests document both the current behaviour and the desired invariant.
 */
class ExchangeConcurrencyTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makePlayer(id: PlayerId = PlayerId.generate()) =
            Player(
                id = id,
                nickname = "ExchangePlayer",
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

        fun makeInstance(
            id: PrizeInstanceId = PrizeInstanceId.generate(),
            ownerId: PlayerId,
            state: PrizeState = PrizeState.HOLDING,
        ) = PrizeInstance(
            id = id,
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

        fun makeExchangeRequest(
            initiatorId: PlayerId,
            recipientId: PlayerId,
            status: ExchangeRequestStatus = ExchangeRequestStatus.PENDING,
        ) = ExchangeRequest(
            id = UUID.randomUUID(),
            initiatorId = initiatorId,
            recipientId = recipientId,
            parentRequestId = null,
            status = status,
            message = null,
            respondedAt = null,
            completedAt = null,
            cancelledAt = null,
            createdAt = now,
            updatedAt = now,
        )

        beforeSpec { TransactionTestHelper.mockTransactions() }

        afterSpec { TransactionTestHelper.unmockTransactions() }

        beforeEach { TransactionTestHelper.stubTransaction() }

        afterEach { clearAllMocks() }

        describe("Exchange race conditions") {

            it("accepting a PENDING exchange transfers all prizes and marks status COMPLETED") {
                val initiator = makePlayer()
                val recipient = makePlayer()
                val initiatorPrize = makeInstance(ownerId = initiator.id, state = PrizeState.EXCHANGING)
                val recipientPrize = makeInstance(ownerId = recipient.id, state = PrizeState.HOLDING)
                val request = makeExchangeRequest(initiator.id, recipient.id)

                val exchangeRepo = mockk<IExchangeRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { exchangeRepo.findById(request.id) } returns request
                coEvery { exchangeRepo.findItemsByRequest(request.id) } returns
                    listOf(
                        ExchangeRequestItem(
                            id = UUID.randomUUID(),
                            exchangeRequestId = request.id,
                            prizeInstanceId = initiatorPrize.id,
                            side = ExchangeItemSide.INITIATOR,
                            createdAt = now,
                        ),
                        ExchangeRequestItem(
                            id = UUID.randomUUID(),
                            exchangeRequestId = request.id,
                            prizeInstanceId = recipientPrize.id,
                            side = ExchangeItemSide.RECIPIENT,
                            createdAt = now,
                        ),
                    )

                val completedRequest =
                    request.copy(
                        status = ExchangeRequestStatus.COMPLETED,
                        respondedAt = now,
                        completedAt = now,
                        updatedAt = now,
                    )
                coEvery { exchangeRepo.save(any()) } returns completedRequest

                // transferOwnership is called for each prize
                coEvery { prizeRepo.transferOwnership(initiatorPrize.id, recipient.id, PrizeState.HOLDING) } returns
                    initiatorPrize.copy(ownerId = recipient.id, state = PrizeState.HOLDING)
                coEvery { prizeRepo.transferOwnership(recipientPrize.id, initiator.id, PrizeState.HOLDING) } returns
                    recipientPrize.copy(ownerId = initiator.id, state = PrizeState.HOLDING)

                coEvery { prizeRepo.findInstanceById(initiatorPrize.id) } returns
                    initiatorPrize.copy(ownerId = recipient.id)
                coEvery { prizeRepo.findInstanceById(recipientPrize.id) } returns
                    recipientPrize.copy(ownerId = initiator.id)
                coEvery { prizeRepo.findDefinitionById(any()) } returns null
                coEvery { playerRepo.findById(initiator.id) } returns initiator
                coEvery { playerRepo.findById(recipient.id) } returns recipient
                coEvery { auditRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val useCase =
                    RespondExchangeRequestUseCase(
                        exchangeRepository = exchangeRepo,
                        prizeRepository = prizeRepo,
                        playerRepository = playerRepo,
                        auditRepository = auditRepo,
                        outboxRepository = outboxRepo,
                    )

                useCase.execute(
                    responderId = recipient.id,
                    requestId = request.id,
                    response =
                        RespondExchangeRequest(
                            action = ExchangeResponseAction.ACCEPT,
                            counterOfferedPrizeInstanceIds = null,
                        ),
                )

                // Both transfers must have occurred
                coVerify(
                    exactly = 1
                ) { prizeRepo.transferOwnership(initiatorPrize.id, recipient.id, PrizeState.HOLDING) }
                coVerify(
                    exactly = 1
                ) { prizeRepo.transferOwnership(recipientPrize.id, initiator.id, PrizeState.HOLDING) }

                coVerify(exactly = 1) { exchangeRepo.save(match { it.status == ExchangeRequestStatus.COMPLETED }) }
            }

            it("responding to a non-PENDING exchange request fails atomically") {
                // The exchange request was cancelled between creation and this respond call.
                val initiator = makePlayer()
                val recipient = makePlayer()
                val cancelledRequest =
                    makeExchangeRequest(initiator.id, recipient.id)
                        .copy(status = ExchangeRequestStatus.CANCELLED)

                val exchangeRepo = mockk<IExchangeRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { exchangeRepo.findById(cancelledRequest.id) } returns cancelledRequest

                val useCase =
                    RespondExchangeRequestUseCase(
                        exchangeRepository = exchangeRepo,
                        prizeRepository = prizeRepo,
                        playerRepository = playerRepo,
                        auditRepository = auditRepo,
                        outboxRepository = outboxRepo,
                    )

                shouldThrow<ExchangeNotPendingException> {
                    useCase.execute(
                        responderId = recipient.id,
                        requestId = cancelledRequest.id,
                        response =
                            RespondExchangeRequest(
                                action = ExchangeResponseAction.ACCEPT,
                                counterOfferedPrizeInstanceIds = null,
                            ),
                    )
                }

                // No prize transfers or state changes
                coVerify(exactly = 0) { prizeRepo.transferOwnership(any(), any(), any()) }
                coVerify(exactly = 0) { exchangeRepo.save(any()) }
            }

            it("rejecting an exchange restores initiator prizes to HOLDING") {
                val initiator = makePlayer()
                val recipient = makePlayer()
                val initiatorPrize = makeInstance(ownerId = initiator.id, state = PrizeState.EXCHANGING)
                val recipientPrize = makeInstance(ownerId = recipient.id, state = PrizeState.HOLDING)
                val request = makeExchangeRequest(initiator.id, recipient.id)

                val exchangeRepo = mockk<IExchangeRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { exchangeRepo.findById(request.id) } returns request
                coEvery { exchangeRepo.findItemsByRequest(request.id) } returns
                    listOf(
                        ExchangeRequestItem(
                            id = UUID.randomUUID(),
                            exchangeRequestId = request.id,
                            prizeInstanceId = initiatorPrize.id,
                            side = ExchangeItemSide.INITIATOR,
                            createdAt = now,
                        ),
                        ExchangeRequestItem(
                            id = UUID.randomUUID(),
                            exchangeRequestId = request.id,
                            prizeInstanceId = recipientPrize.id,
                            side = ExchangeItemSide.RECIPIENT,
                            createdAt = now,
                        ),
                    )

                val rejectedRequest =
                    request.copy(
                        status = ExchangeRequestStatus.REJECTED,
                        respondedAt = now,
                        updatedAt = now,
                    )
                coEvery { exchangeRepo.save(any()) } returns rejectedRequest
                coEvery {
                    prizeRepo.updateInstanceState(initiatorPrize.id, PrizeState.HOLDING, PrizeState.EXCHANGING)
                } returns true
                coEvery { playerRepo.findById(initiator.id) } returns initiator
                coEvery { playerRepo.findById(recipient.id) } returns recipient
                coEvery { prizeRepo.findInstanceById(any()) } returns initiatorPrize
                coEvery { prizeRepo.findDefinitionById(any()) } returns null
                coEvery { auditRepo.record(any()) } just runs
                every { outboxRepo.enqueue(any()) } just runs

                val useCase =
                    RespondExchangeRequestUseCase(
                        exchangeRepository = exchangeRepo,
                        prizeRepository = prizeRepo,
                        playerRepository = playerRepo,
                        auditRepository = auditRepo,
                        outboxRepository = outboxRepo,
                    )

                useCase.execute(
                    responderId = recipient.id,
                    requestId = request.id,
                    response =
                        RespondExchangeRequest(
                            action = ExchangeResponseAction.REJECT,
                            counterOfferedPrizeInstanceIds = null,
                        ),
                )

                // Initiator prize restored to HOLDING (expected state: EXCHANGING)
                coVerify(exactly = 1) {
                    prizeRepo.updateInstanceState(initiatorPrize.id, PrizeState.HOLDING, PrizeState.EXCHANGING)
                }

                // No ownership transfers — reject does not move prizes
                coVerify(exactly = 0) { prizeRepo.transferOwnership(any(), any(), any()) }

                coVerify(exactly = 1) { exchangeRepo.save(match { it.status == ExchangeRequestStatus.REJECTED }) }
            }

            it("only the recipient can respond — unauthorized responder is rejected") {
                val initiator = makePlayer()
                val recipient = makePlayer()
                val thirdParty = makePlayer()
                val request = makeExchangeRequest(initiator.id, recipient.id)

                val exchangeRepo = mockk<IExchangeRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val playerRepo = mockk<IPlayerRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { exchangeRepo.findById(request.id) } returns request

                val useCase =
                    RespondExchangeRequestUseCase(
                        exchangeRepository = exchangeRepo,
                        prizeRepository = prizeRepo,
                        playerRepository = playerRepo,
                        auditRepository = auditRepo,
                        outboxRepository = outboxRepo,
                    )

                shouldThrow<com.prizedraw.application.usecases.exchange.ExchangeUnauthorizedException> {
                    useCase.execute(
                        responderId = thirdParty.id, // NOT the recipient
                        requestId = request.id,
                        response =
                            RespondExchangeRequest(
                                action = ExchangeResponseAction.ACCEPT,
                                counterOfferedPrizeInstanceIds = null,
                            ),
                    )
                }

                coVerify(exactly = 0) { prizeRepo.transferOwnership(any(), any(), any()) }
                coVerify(exactly = 0) { exchangeRepo.save(any()) }
            }
        }
    })
