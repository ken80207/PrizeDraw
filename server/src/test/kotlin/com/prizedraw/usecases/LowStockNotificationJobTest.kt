package com.prizedraw.usecases

import com.prizedraw.application.events.LowStockNotificationJob
import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.contracts.enums.ApprovalStatus
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.Notification
import com.prizedraw.domain.valueobjects.CampaignId
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coJustRun
import io.mockk.coVerify
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import io.mockk.slot
import kotlinx.datetime.Clock
import java.util.UUID

/**
 * Unit tests for [LowStockNotificationJob].
 *
 * The job calls [checkLowStock] immediately after [start], then waits 5 minutes.
 * A 200ms sleep is sufficient to capture the first cycle without waiting for the delay.
 */
class LowStockNotificationJobTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makeKujiCampaign(id: CampaignId = CampaignId.generate()) =
            KujiCampaign(
                id = id,
                title = "Low Stock Campaign",
                description = null,
                coverImageUrl = null,
                pricePerDraw = 100,
                drawSessionSeconds = 30,
                status = CampaignStatus.ACTIVE,
                activatedAt = now,
                soldOutAt = null,
                createdByStaffId = UUID.randomUUID(),
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
                approvalStatus = ApprovalStatus.NOT_REQUIRED,
            )

        afterEach { clearAllMocks() }

        describe("LowStockNotificationJob") {

            it("dispatches notifications and marks campaign when ratio is below threshold (5/100 = 0.05 < 0.10)") {
                val campaignId = CampaignId.generate()
                val campaign = makeKujiCampaign(campaignId)
                val player1 = UUID.randomUUID()
                val player2 = UUID.randomUUID()

                val campaignRepo = mockk<ICampaignRepository>()
                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val notificationRepo = mockk<INotificationRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { campaignRepo.findActiveKujiCampaignsNotLowStockNotified() } returns listOf(campaign)
                coEvery { campaignRepo.countTotalTickets(campaignId) } returns 100
                coEvery { campaignRepo.countRemainingTickets(campaignId) } returns 5
                coEvery { favoriteRepo.findPlayerIdsByCampaign(CampaignType.KUJI, campaignId) } returns
                    listOf(player1, player2)

                val notificationsSlot = slot<List<Notification>>()
                coJustRun { notificationRepo.batchInsertIgnore(capture(notificationsSlot)) }
                coJustRun { campaignRepo.markLowStockNotified(campaignId) }
                every { outboxRepo.enqueue(any()) } just runs

                val job = LowStockNotificationJob(campaignRepo, favoriteRepo, notificationRepo, outboxRepo)
                job.start()
                Thread.sleep(200)
                job.stop()

                coVerify(atLeast = 1) { notificationRepo.batchInsertIgnore(any()) }
                coVerify(atLeast = 1) { campaignRepo.markLowStockNotified(campaignId) }

                val notifications = notificationsSlot.captured
                notifications.all { it.eventType == "favorite.campaign_low_stock" } shouldBe true
                notifications.all {
                    it.dedupKey?.startsWith(
                        "favorite.campaign_low_stock:${campaignId.value}:"
                    ) == true
                } shouldBe
                    true
            }

            it("does nothing when findActiveKujiCampaignsNotLowStockNotified returns empty list") {
                val campaignRepo = mockk<ICampaignRepository>()
                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val notificationRepo = mockk<INotificationRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { campaignRepo.findActiveKujiCampaignsNotLowStockNotified() } returns emptyList()

                val job = LowStockNotificationJob(campaignRepo, favoriteRepo, notificationRepo, outboxRepo)
                job.start()
                Thread.sleep(200)
                job.stop()

                coVerify(exactly = 0) { notificationRepo.batchInsertIgnore(any()) }
                coVerify(exactly = 0) { campaignRepo.markLowStockNotified(any()) }
            }

            it("skips campaign when remaining ratio is at or above threshold (20/100 = 0.20 >= 0.10)") {
                val campaignId = CampaignId.generate()
                val campaign = makeKujiCampaign(campaignId)

                val campaignRepo = mockk<ICampaignRepository>()
                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val notificationRepo = mockk<INotificationRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { campaignRepo.findActiveKujiCampaignsNotLowStockNotified() } returns listOf(campaign)
                coEvery { campaignRepo.countTotalTickets(campaignId) } returns 100
                coEvery { campaignRepo.countRemainingTickets(campaignId) } returns 20

                val job = LowStockNotificationJob(campaignRepo, favoriteRepo, notificationRepo, outboxRepo)
                job.start()
                Thread.sleep(200)
                job.stop()

                coVerify(exactly = 0) { notificationRepo.batchInsertIgnore(any()) }
                coVerify(exactly = 0) { campaignRepo.markLowStockNotified(any()) }
            }

            it("marks campaign notified even when no players have favorited it") {
                val campaignId = CampaignId.generate()
                val campaign = makeKujiCampaign(campaignId)

                val campaignRepo = mockk<ICampaignRepository>()
                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val notificationRepo = mockk<INotificationRepository>()
                val outboxRepo = mockk<IOutboxRepository>()

                coEvery { campaignRepo.findActiveKujiCampaignsNotLowStockNotified() } returns listOf(campaign)
                coEvery { campaignRepo.countTotalTickets(campaignId) } returns 100
                coEvery { campaignRepo.countRemainingTickets(campaignId) } returns 3
                coEvery { favoriteRepo.findPlayerIdsByCampaign(CampaignType.KUJI, campaignId) } returns emptyList()
                coJustRun { campaignRepo.markLowStockNotified(campaignId) }

                val job = LowStockNotificationJob(campaignRepo, favoriteRepo, notificationRepo, outboxRepo)
                job.start()
                Thread.sleep(200)
                job.stop()

                coVerify(exactly = 0) { notificationRepo.batchInsertIgnore(any()) }
                coVerify(atLeast = 1) { campaignRepo.markLowStockNotified(campaignId) }
            }
        }
    })
