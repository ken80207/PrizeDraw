package com.prizedraw.concurrency

import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.usecases.favorite.AddFavoriteUseCase
import com.prizedraw.application.usecases.favorite.RemoveFavoriteUseCase
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.testutil.TransactionTestHelper
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coJustRun
import io.mockk.mockk
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import java.util.concurrent.atomic.AtomicInteger

/**
 * Concurrency tests for campaign favorites use cases.
 *
 * Verifies:
 *  - Simultaneous add/remove for the same player/campaign does not throw unhandled errors.
 *  - 100 players concurrently adding the same campaign all succeed without race conditions.
 */
class FavoriteConcurrencyTest :
    DescribeSpec({

        beforeEach {
            TransactionTestHelper.mockTransactions()
        }

        afterEach {
            clearAllMocks()
            TransactionTestHelper.unmockTransactions()
        }

        describe("Favorites concurrency") {

            it("simultaneous add and remove for same player+campaign complete without unhandled errors") {
                val campaignId = CampaignId.generate()
                val playerId = PlayerId.generate()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val campaignRepo = mockk<ICampaignRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } returns
                    com.prizedraw.domain.entities.KujiCampaign(
                        id = campaignId,
                        title = "Test Kuji",
                        description = null,
                        coverImageUrl = null,
                        pricePerDraw = 100,
                        drawSessionSeconds = 30,
                        status = com.prizedraw.contracts.enums.CampaignStatus.ACTIVE,
                        activatedAt =
                            kotlinx.datetime.Clock.System
                                .now(),
                        soldOutAt = null,
                        createdByStaffId = java.util.UUID.randomUUID(),
                        deletedAt = null,
                        createdAt =
                            kotlinx.datetime.Clock.System
                                .now(),
                        updatedAt =
                            kotlinx.datetime.Clock.System
                                .now(),
                        approvalStatus = com.prizedraw.contracts.enums.ApprovalStatus.NOT_REQUIRED,
                    )
                coJustRun { favoriteRepo.save(any()) }
                coJustRun { favoriteRepo.delete(any(), any(), any()) }

                val addUseCase = AddFavoriteUseCase(favoriteRepo, campaignRepo)
                val removeUseCase = RemoveFavoriteUseCase(favoriteRepo)

                val successCount = AtomicInteger(0)

                coroutineScope {
                    (1..10)
                        .map { i ->
                            async {
                                runCatching {
                                    if (i % 2 == 0) {
                                        addUseCase.execute(playerId, CampaignType.KUJI, campaignId)
                                    } else {
                                        removeUseCase.execute(playerId, CampaignType.KUJI, campaignId)
                                    }
                                }.onSuccess { successCount.incrementAndGet() }
                            }
                        }.awaitAll()
                }

                successCount.get() shouldBe 10
            }

            it("100 players concurrently adding the same campaign all succeed") {
                val campaignId = CampaignId.generate()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val campaignRepo = mockk<ICampaignRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } returns
                    com.prizedraw.domain.entities.KujiCampaign(
                        id = campaignId,
                        title = "Popular Kuji",
                        description = null,
                        coverImageUrl = null,
                        pricePerDraw = 200,
                        drawSessionSeconds = 60,
                        status = com.prizedraw.contracts.enums.CampaignStatus.ACTIVE,
                        activatedAt =
                            kotlinx.datetime.Clock.System
                                .now(),
                        soldOutAt = null,
                        createdByStaffId = java.util.UUID.randomUUID(),
                        deletedAt = null,
                        createdAt =
                            kotlinx.datetime.Clock.System
                                .now(),
                        updatedAt =
                            kotlinx.datetime.Clock.System
                                .now(),
                        approvalStatus = com.prizedraw.contracts.enums.ApprovalStatus.NOT_REQUIRED,
                    )
                coJustRun { favoriteRepo.save(any()) }

                val addUseCase = AddFavoriteUseCase(favoriteRepo, campaignRepo)

                val successCount = AtomicInteger(0)

                coroutineScope {
                    (1..100)
                        .map {
                            val playerId = PlayerId.generate()
                            async {
                                runCatching {
                                    addUseCase.execute(playerId, CampaignType.KUJI, campaignId)
                                }.onSuccess { successCount.incrementAndGet() }
                            }
                        }.awaitAll()
                }

                successCount.get() shouldBe 100
                successCount.get() shouldBeGreaterThan 0
            }
        }
    })
