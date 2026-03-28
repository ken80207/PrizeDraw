package com.prizedraw.usecases

import com.prizedraw.application.events.FavoriteCampaignRestocked
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.application.usecases.admin.AddTicketBoxUseCase
import com.prizedraw.contracts.dto.admin.CreateKujiBoxRequest
import com.prizedraw.contracts.dto.admin.CreateKujiTicketRangeRequest
import com.prizedraw.contracts.enums.ApprovalStatus
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.Notification
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.entities.TicketBoxStatus
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.StaffId
import com.prizedraw.testutil.TransactionTestHelper
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coJustRun
import io.mockk.coVerify
import io.mockk.every
import io.mockk.just
import io.mockk.justRun
import io.mockk.mockk
import io.mockk.runs
import io.mockk.slot
import kotlinx.datetime.Clock
import java.util.UUID

/**
 * Unit tests for [AddTicketBoxUseCase].
 */
class AddTicketBoxUseCaseTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makeKujiCampaign(
            id: CampaignId = CampaignId.generate(),
            status: CampaignStatus = CampaignStatus.ACTIVE,
            title: String = "テスト一番賞活動",
        ) = KujiCampaign(
            id = id,
            title = title,
            description = null,
            coverImageUrl = null,
            pricePerDraw = 100,
            drawSessionSeconds = 30,
            status = status,
            activatedAt =
                if (status == CampaignStatus.ACTIVE) {
                    now
                } else {
                    null
                },
            soldOutAt =
                if (status == CampaignStatus.SOLD_OUT) {
                    now
                } else {
                    null
                },
            createdByStaffId = UUID.randomUUID(),
            deletedAt = null,
            createdAt = now,
            updatedAt = now,
            approvalStatus = ApprovalStatus.NOT_REQUIRED,
        )

        fun makeTicketBox(
            campaignId: CampaignId,
            displayOrder: Int = 0,
        ) = TicketBox(
            id = UUID.randomUUID(),
            kujiCampaignId = campaignId,
            name = "Box $displayOrder",
            totalTickets = 10,
            remainingTickets = 10,
            status = TicketBoxStatus.AVAILABLE,
            soldOutAt = null,
            displayOrder = displayOrder,
            createdAt = now,
            updatedAt = now,
        )

        fun makePrizeDef(
            campaignId: CampaignId,
            displayOrder: Int = 0,
        ) = PrizeDefinition(
            id = PrizeDefinitionId.generate(),
            kujiCampaignId = campaignId,
            unlimitedCampaignId = null,
            grade = "A",
            name = "Prize $displayOrder",
            photos = listOf("https://cdn.example.com/img.jpg"),
            prizeValue = 500,
            buybackPrice = 0,
            buybackEnabled = true,
            probabilityBps = null,
            ticketCount = 5,
            displayOrder = displayOrder,
            createdAt = now,
            updatedAt = now,
        )

        fun makeBoxRequest(name: String = "New Box") =
            CreateKujiBoxRequest(
                name = name,
                totalTickets = 10,
                ticketRanges =
                    listOf(
                        CreateKujiTicketRangeRequest(
                            grade = "A",
                            prizeName = "Test Prize",
                            rangeStart = 1,
                            rangeEnd = 10,
                            prizeValue = 500,
                            photoUrl = "https://cdn.example.com/prize.jpg",
                        ),
                    ),
            )

        fun buildUseCase(
            campaignRepository: ICampaignRepository,
            ticketBoxRepository: ITicketBoxRepository,
            prizeRepository: IPrizeRepository,
            auditRepository: IAuditRepository,
            favoriteRepo: ICampaignFavoriteRepository,
            notificationRepo: INotificationRepository,
            outboxRepo: IOutboxRepository,
        ) = AddTicketBoxUseCase(
            campaignRepository = campaignRepository,
            ticketBoxRepository = ticketBoxRepository,
            prizeRepository = prizeRepository,
            auditRepository = auditRepository,
            favoriteRepo = favoriteRepo,
            notificationRepo = notificationRepo,
            outboxRepo = outboxRepo,
        )

        beforeEach { TransactionTestHelper.mockTransactions() }

        afterEach {
            clearAllMocks()
            TransactionTestHelper.unmockTransactions()
        }

        describe("AddTicketBoxUseCase") {

            it("should add boxes to a SOLD_OUT campaign and notify favorites") {
                val campaignId = CampaignId.generate()
                val staffId = StaffId.generate()
                val player1 = UUID.randomUUID()
                val player2 = UUID.randomUUID()
                val soldOutCampaign = makeKujiCampaign(id = campaignId, status = CampaignStatus.SOLD_OUT)

                val campaignRepo = mockk<ICampaignRepository>()
                val ticketBoxRepo = mockk<ITicketBoxRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val notificationRepo = mockk<INotificationRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } returns soldOutCampaign
                coEvery { ticketBoxRepo.findByCampaignId(campaignId) } returns emptyList()
                coEvery { prizeRepo.findDefinitionsByCampaign(campaignId, CampaignType.KUJI) } returns emptyList()
                coEvery { ticketBoxRepo.save(any()) } answers { firstArg() }
                coEvery { prizeRepo.saveDefinition(any()) } answers { firstArg() }

                val savedCampaignSlot = slot<KujiCampaign>()
                coEvery { campaignRepo.saveKuji(capture(savedCampaignSlot)) } answers { firstArg() }

                justRun { auditRepo.record(any()) }
                coEvery { favoriteRepo.findPlayerIdsByCampaign(CampaignType.KUJI, campaignId) } returns
                    listOf(player1, player2)

                val notificationsSlot = slot<List<Notification>>()
                coJustRun { notificationRepo.batchInsertIgnore(capture(notificationsSlot)) }
                every { outboxRepo.enqueue(any()) } just runs

                val useCase =
                    buildUseCase(
                        campaignRepository = campaignRepo,
                        ticketBoxRepository = ticketBoxRepo,
                        prizeRepository = prizeRepo,
                        auditRepository = auditRepo,
                        favoriteRepo = favoriteRepo,
                        notificationRepo = notificationRepo,
                        outboxRepo = outboxRepo,
                    )

                val result = useCase.execute(staffId, campaignId, listOf(makeBoxRequest()))

                result shouldHaveSize 1

                // Campaign should have been updated to ACTIVE with soldOutAt and lowStockNotifiedAt cleared
                val saved = savedCampaignSlot.captured
                saved.status shouldBe CampaignStatus.ACTIVE
                saved.soldOutAt.shouldBeNull()
                saved.lowStockNotifiedAt.shouldBeNull()

                // Both favoriting players should receive notifications
                val notifications = notificationsSlot.captured
                notifications shouldHaveSize 2
                notifications.all { it.eventType == "favorite.campaign_restocked" } shouldBe true
                notifications.map { it.playerId }.toSet() shouldBe setOf(player1, player2)

                // Outbox events should be enqueued per player
                coVerify(exactly = 2) { outboxRepo.enqueue(any<FavoriteCampaignRestocked>()) }
            }

            it("should add boxes to ACTIVE campaign without notification") {
                val campaignId = CampaignId.generate()
                val staffId = StaffId.generate()
                val activeCampaign = makeKujiCampaign(id = campaignId, status = CampaignStatus.ACTIVE)

                val campaignRepo = mockk<ICampaignRepository>()
                val ticketBoxRepo = mockk<ITicketBoxRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val notificationRepo = mockk<INotificationRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } returns activeCampaign
                coEvery { ticketBoxRepo.findByCampaignId(campaignId) } returns emptyList()
                coEvery { prizeRepo.findDefinitionsByCampaign(campaignId, CampaignType.KUJI) } returns emptyList()
                coEvery { ticketBoxRepo.save(any()) } answers { firstArg() }
                coEvery { prizeRepo.saveDefinition(any()) } answers { firstArg() }
                justRun { auditRepo.record(any()) }

                val useCase =
                    buildUseCase(
                        campaignRepository = campaignRepo,
                        ticketBoxRepository = ticketBoxRepo,
                        prizeRepository = prizeRepo,
                        auditRepository = auditRepo,
                        favoriteRepo = favoriteRepo,
                        notificationRepo = notificationRepo,
                        outboxRepo = outboxRepo,
                    )

                val result = useCase.execute(staffId, campaignId, listOf(makeBoxRequest()))

                result shouldHaveSize 1

                // saveKuji should NOT be called for ACTIVE campaigns
                coVerify(exactly = 0) { campaignRepo.saveKuji(any()) }
                // No notifications or outbox events
                coVerify(exactly = 0) { notificationRepo.batchInsertIgnore(any()) }
                coVerify(exactly = 0) { outboxRepo.enqueue(any()) }
            }

            it("should reject DRAFT campaign") {
                val campaignId = CampaignId.generate()
                val staffId = StaffId.generate()
                val draftCampaign = makeKujiCampaign(id = campaignId, status = CampaignStatus.DRAFT)

                val campaignRepo = mockk<ICampaignRepository>()
                val ticketBoxRepo = mockk<ITicketBoxRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val notificationRepo = mockk<INotificationRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } returns draftCampaign

                val useCase =
                    buildUseCase(
                        campaignRepository = campaignRepo,
                        ticketBoxRepository = ticketBoxRepo,
                        prizeRepository = prizeRepo,
                        auditRepository = auditRepo,
                        favoriteRepo = favoriteRepo,
                        notificationRepo = notificationRepo,
                        outboxRepo = outboxRepo,
                    )

                shouldThrow<IllegalArgumentException> {
                    useCase.execute(staffId, campaignId, listOf(makeBoxRequest()))
                }
            }

            it("should reject empty boxes list") {
                val campaignId = CampaignId.generate()
                val staffId = StaffId.generate()
                val activeCampaign = makeKujiCampaign(id = campaignId, status = CampaignStatus.ACTIVE)

                val campaignRepo = mockk<ICampaignRepository>()
                val ticketBoxRepo = mockk<ITicketBoxRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val notificationRepo = mockk<INotificationRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } returns activeCampaign

                val useCase =
                    buildUseCase(
                        campaignRepository = campaignRepo,
                        ticketBoxRepository = ticketBoxRepo,
                        prizeRepository = prizeRepo,
                        auditRepository = auditRepo,
                        favoriteRepo = favoriteRepo,
                        notificationRepo = notificationRepo,
                        outboxRepo = outboxRepo,
                    )

                shouldThrow<IllegalArgumentException> {
                    useCase.execute(staffId, campaignId, emptyList())
                }
            }

            it("should continue displayOrder from existing boxes") {
                val campaignId = CampaignId.generate()
                val staffId = StaffId.generate()
                val activeCampaign = makeKujiCampaign(id = campaignId, status = CampaignStatus.ACTIVE)
                val existingBox = makeTicketBox(campaignId, displayOrder = 2)
                val existingPrize = makePrizeDef(campaignId, displayOrder = 3)

                val campaignRepo = mockk<ICampaignRepository>()
                val ticketBoxRepo = mockk<ITicketBoxRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val notificationRepo = mockk<INotificationRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } returns activeCampaign
                coEvery { ticketBoxRepo.findByCampaignId(campaignId) } returns listOf(existingBox)
                coEvery { prizeRepo.findDefinitionsByCampaign(campaignId, CampaignType.KUJI) } returns
                    listOf(existingPrize)

                val savedBoxSlot = slot<TicketBox>()
                coEvery { ticketBoxRepo.save(capture(savedBoxSlot)) } answers { firstArg() }

                val savedPrizeSlot = slot<PrizeDefinition>()
                coEvery { prizeRepo.saveDefinition(capture(savedPrizeSlot)) } answers { firstArg() }

                justRun { auditRepo.record(any()) }

                val useCase =
                    buildUseCase(
                        campaignRepository = campaignRepo,
                        ticketBoxRepository = ticketBoxRepo,
                        prizeRepository = prizeRepo,
                        auditRepository = auditRepo,
                        favoriteRepo = favoriteRepo,
                        notificationRepo = notificationRepo,
                        outboxRepo = outboxRepo,
                    )

                useCase.execute(staffId, campaignId, listOf(makeBoxRequest()))

                // New box should get displayOrder = max(2) + 1 = 3
                savedBoxSlot.captured.displayOrder shouldBe 3
                // New prize should get displayOrder = max(3) + 1 = 4
                savedPrizeSlot.captured.displayOrder shouldBe 4
            }

            it("should send no notification when SOLD_OUT campaign has zero favorites") {
                val campaignId = CampaignId.generate()
                val staffId = StaffId.generate()
                val soldOutCampaign = makeKujiCampaign(id = campaignId, status = CampaignStatus.SOLD_OUT)

                val campaignRepo = mockk<ICampaignRepository>()
                val ticketBoxRepo = mockk<ITicketBoxRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val notificationRepo = mockk<INotificationRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } returns soldOutCampaign
                coEvery { ticketBoxRepo.findByCampaignId(campaignId) } returns emptyList()
                coEvery { prizeRepo.findDefinitionsByCampaign(campaignId, CampaignType.KUJI) } returns emptyList()
                coEvery { ticketBoxRepo.save(any()) } answers { firstArg() }
                coEvery { prizeRepo.saveDefinition(any()) } answers { firstArg() }
                coEvery { campaignRepo.saveKuji(any()) } answers { firstArg() }
                justRun { auditRepo.record(any()) }
                coEvery { favoriteRepo.findPlayerIdsByCampaign(CampaignType.KUJI, campaignId) } returns emptyList()

                val useCase =
                    buildUseCase(
                        campaignRepository = campaignRepo,
                        ticketBoxRepository = ticketBoxRepo,
                        prizeRepository = prizeRepo,
                        auditRepository = auditRepo,
                        favoriteRepo = favoriteRepo,
                        notificationRepo = notificationRepo,
                        outboxRepo = outboxRepo,
                    )

                val result = useCase.execute(staffId, campaignId, listOf(makeBoxRequest()))

                result shouldHaveSize 1

                // Campaign should still be updated to ACTIVE even with no favorites
                coVerify(exactly = 1) { campaignRepo.saveKuji(any()) }
                // But no notifications should be sent
                coVerify(exactly = 0) { notificationRepo.batchInsertIgnore(any()) }
                coVerify(exactly = 0) { outboxRepo.enqueue(any()) }
            }
        }
    })
