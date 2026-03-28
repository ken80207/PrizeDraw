package com.prizedraw.integration

import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ISystemSettingsRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.application.usecases.admin.UpdateCampaignStatusUseCase
import com.prizedraw.contracts.enums.ApprovalStatus
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.Notification
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.entities.TicketBoxStatus
import com.prizedraw.domain.services.MarginRiskService
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.StaffId
import com.prizedraw.testutil.TransactionTestHelper
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.collections.shouldHaveSize
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
import java.math.BigDecimal
import java.util.UUID

/**
 * Integration tests for [UpdateCampaignStatusUseCase] — specifically the notification fan-out
 * logic that fires when a favorited campaign transitions to [CampaignStatus.ACTIVE].
 */
class FavoriteNotificationIntegrationTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makeKujiCampaign(
            id: CampaignId,
            status: CampaignStatus,
        ) = KujiCampaign(
            id = id,
            title = "Test Kuji 活動",
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
            soldOutAt = null,
            createdByStaffId = UUID.randomUUID(),
            deletedAt = null,
            createdAt = now,
            updatedAt = now,
            approvalStatus = ApprovalStatus.NOT_REQUIRED,
        )

        fun makeTicketBox(campaignId: CampaignId): TicketBox =
            TicketBox(
                id = UUID.randomUUID(),
                kujiCampaignId = campaignId,
                name = "Box A",
                totalTickets = 10,
                remainingTickets = 10,
                status = TicketBoxStatus.AVAILABLE,
                soldOutAt = null,
                displayOrder = 1,
                createdAt = now,
                updatedAt = now,
            )

        fun makePrizeDef(campaignId: CampaignId): PrizeDefinition =
            PrizeDefinition(
                id = PrizeDefinitionId.generate(),
                kujiCampaignId = campaignId,
                unlimitedCampaignId = null,
                grade = "A",
                name = "Prize A",
                photos = listOf("https://cdn.example.com/img.jpg"),
                prizeValue = 50,
                buybackPrice = 30,
                buybackEnabled = true,
                probabilityBps = null,
                ticketCount = 10,
                displayOrder = 1,
                createdAt = now,
                updatedAt = now,
            )

        fun buildUseCase(
            campaignRepository: ICampaignRepository,
            ticketBoxRepository: ITicketBoxRepository,
            prizeRepository: IPrizeRepository,
            auditRepository: IAuditRepository,
            favoriteRepo: ICampaignFavoriteRepository,
            notificationRepo: INotificationRepository,
            outboxRepo: IOutboxRepository,
        ): UpdateCampaignStatusUseCase {
            val settingsRepository = mockk<ISystemSettingsRepository>()
            coEvery { settingsRepository.getMarginThresholdPct() } returns BigDecimal("0.00")
            return UpdateCampaignStatusUseCase(
                campaignRepository = campaignRepository,
                ticketBoxRepository = ticketBoxRepository,
                prizeRepository = prizeRepository,
                auditRepository = auditRepository,
                marginRiskService = MarginRiskService(),
                settingsRepository = settingsRepository,
                favoriteRepo = favoriteRepo,
                notificationRepo = notificationRepo,
                outboxRepo = outboxRepo,
            )
        }

        beforeEach { TransactionTestHelper.mockTransactions() }

        afterEach {
            clearAllMocks()
            TransactionTestHelper.unmockTransactions()
        }

        describe("UpdateCampaignStatusUseCase — notification fan-out") {

            it("sends notifications to all favoriting players when campaign transitions DRAFT → ACTIVE") {
                val campaignId = CampaignId.generate()
                val staffId = StaffId.generate()
                val player1 = UUID.randomUUID()
                val player2 = UUID.randomUUID()

                val draftCampaign = makeKujiCampaign(campaignId, CampaignStatus.DRAFT)
                val activeCampaign = makeKujiCampaign(campaignId, CampaignStatus.ACTIVE)
                val box = makeTicketBox(campaignId)
                val prize = makePrizeDef(campaignId)

                val campaignRepo = mockk<ICampaignRepository>()
                val ticketBoxRepo = mockk<ITicketBoxRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val notificationRepo = mockk<INotificationRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                // findKujiById called 3 times: status resolution, margin gate re-fetch, title resolution
                coEvery { campaignRepo.findKujiById(campaignId) } returnsMany
                    listOf(draftCampaign, draftCampaign, activeCampaign)
                coEvery { ticketBoxRepo.findByCampaignId(campaignId) } returns listOf(box)
                coEvery { prizeRepo.findDefinitionsByCampaign(campaignId, CampaignType.KUJI) } returns listOf(prize)
                coJustRun { campaignRepo.updateKujiStatus(campaignId, CampaignStatus.ACTIVE) }
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

                useCase.execute(
                    staffId = staffId,
                    campaignId = campaignId,
                    campaignType = CampaignType.KUJI,
                    newStatus = CampaignStatus.ACTIVE,
                    confirmLowMargin = true,
                )

                val notifications = notificationsSlot.captured
                notifications shouldHaveSize 2
                notifications.all { it.eventType == "favorite.campaign_activated" } shouldBe true
                notifications.all {
                    it.dedupKey?.startsWith(
                        "favorite.campaign_activated:${campaignId.value}:"
                    ) == true
                } shouldBe
                    true
                notifications.map { it.playerId }.toSet() shouldBe setOf(player1, player2)
            }

            it("does not call batchInsertIgnore when no players have favorited the campaign") {
                val campaignId = CampaignId.generate()
                val staffId = StaffId.generate()

                val draftCampaign = makeKujiCampaign(campaignId, CampaignStatus.DRAFT)
                val activeCampaign = makeKujiCampaign(campaignId, CampaignStatus.ACTIVE)
                val box = makeTicketBox(campaignId)
                val prize = makePrizeDef(campaignId)

                val campaignRepo = mockk<ICampaignRepository>()
                val ticketBoxRepo = mockk<ITicketBoxRepository>()
                val prizeRepo = mockk<IPrizeRepository>()
                val auditRepo = mockk<IAuditRepository>()
                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val notificationRepo = mockk<INotificationRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } returnsMany
                    listOf(draftCampaign, draftCampaign, activeCampaign)
                coEvery { ticketBoxRepo.findByCampaignId(campaignId) } returns listOf(box)
                coEvery { prizeRepo.findDefinitionsByCampaign(campaignId, CampaignType.KUJI) } returns listOf(prize)
                coJustRun { campaignRepo.updateKujiStatus(campaignId, CampaignStatus.ACTIVE) }
                justRun { auditRepo.record(any()) }
                coEvery { favoriteRepo.findPlayerIdsByCampaign(CampaignType.KUJI, campaignId) } returns emptyList()
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

                useCase.execute(
                    staffId = staffId,
                    campaignId = campaignId,
                    campaignType = CampaignType.KUJI,
                    newStatus = CampaignStatus.ACTIVE,
                    confirmLowMargin = true,
                )

                coVerify(exactly = 0) { notificationRepo.batchInsertIgnore(any()) }
            }
        }
    })
