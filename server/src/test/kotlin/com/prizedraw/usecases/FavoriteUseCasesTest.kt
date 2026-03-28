package com.prizedraw.usecases

import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.usecases.favorite.AddFavoriteUseCase
import com.prizedraw.application.usecases.favorite.GetFavoritesUseCase
import com.prizedraw.application.usecases.favorite.RemoveFavoriteUseCase
import com.prizedraw.contracts.enums.ApprovalStatus
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.CampaignFavorite
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.UnlimitedCampaign
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.testutil.TransactionTestHelper
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.collections.shouldBeEmpty
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coJustRun
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.datetime.Clock
import java.util.UUID

/**
 * Unit tests for [AddFavoriteUseCase], [RemoveFavoriteUseCase], and [GetFavoritesUseCase].
 */
class FavoriteUseCasesTest :
    DescribeSpec({

        val now = Clock.System.now()

        fun makeKujiCampaign(id: CampaignId = CampaignId.generate()) =
            KujiCampaign(
                id = id,
                title = "Test Kuji Campaign",
                description = null,
                coverImageUrl = "https://cdn.example.com/kuji.jpg",
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

        fun makeUnlimitedCampaign(id: CampaignId = CampaignId.generate()) =
            UnlimitedCampaign(
                id = id,
                title = "Test Unlimited Campaign",
                description = null,
                coverImageUrl = "https://cdn.example.com/unlimited.jpg",
                pricePerDraw = 200,
                rateLimitPerSecond = 1,
                status = CampaignStatus.ACTIVE,
                activatedAt = now,
                createdByStaffId = UUID.randomUUID(),
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
                approvalStatus = ApprovalStatus.NOT_REQUIRED,
            )

        fun makeFavorite(
            playerId: PlayerId,
            campaignType: CampaignType,
            campaignId: CampaignId,
        ) = CampaignFavorite(
            playerId = playerId,
            campaignType = campaignType,
            campaignId = campaignId,
            createdAt = now,
        )

        beforeSpec { TransactionTestHelper.mockTransactions() }

        afterSpec { TransactionTestHelper.unmockTransactions() }

        beforeEach { TransactionTestHelper.stubTransaction() }

        afterEach { clearAllMocks() }

        // -----------------------------------------------------------------------------------------
        // AddFavoriteUseCase
        // -----------------------------------------------------------------------------------------
        describe("AddFavoriteUseCase") {

            it("saves favorite when KUJI campaign exists") {
                val playerId = PlayerId.generate()
                val campaignId = CampaignId.generate()
                val campaign = makeKujiCampaign(campaignId)

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val campaignRepo = mockk<ICampaignRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } returns campaign
                coJustRun { favoriteRepo.save(any()) }

                val useCase = AddFavoriteUseCase(favoriteRepo, campaignRepo)
                useCase.execute(playerId, CampaignType.KUJI, campaignId)

                coVerify(exactly = 1) { favoriteRepo.save(any()) }
            }

            it("saves favorite when UNLIMITED campaign exists") {
                val playerId = PlayerId.generate()
                val campaignId = CampaignId.generate()
                val campaign = makeUnlimitedCampaign(campaignId)

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val campaignRepo = mockk<ICampaignRepository>()

                coEvery { campaignRepo.findUnlimitedById(campaignId) } returns campaign
                coJustRun { favoriteRepo.save(any()) }

                val useCase = AddFavoriteUseCase(favoriteRepo, campaignRepo)
                useCase.execute(playerId, CampaignType.UNLIMITED, campaignId)

                coVerify(exactly = 1) { favoriteRepo.save(any()) }
            }

            it("throws IllegalArgumentException when KUJI campaign not found") {
                val playerId = PlayerId.generate()
                val campaignId = CampaignId.generate()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val campaignRepo = mockk<ICampaignRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } returns null

                val useCase = AddFavoriteUseCase(favoriteRepo, campaignRepo)

                shouldThrow<IllegalArgumentException> {
                    useCase.execute(playerId, CampaignType.KUJI, campaignId)
                }

                coVerify(exactly = 0) { favoriteRepo.save(any()) }
            }

            it("throws IllegalArgumentException when UNLIMITED campaign not found") {
                val playerId = PlayerId.generate()
                val campaignId = CampaignId.generate()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val campaignRepo = mockk<ICampaignRepository>()

                coEvery { campaignRepo.findUnlimitedById(campaignId) } returns null

                val useCase = AddFavoriteUseCase(favoriteRepo, campaignRepo)

                shouldThrow<IllegalArgumentException> {
                    useCase.execute(playerId, CampaignType.UNLIMITED, campaignId)
                }

                coVerify(exactly = 0) { favoriteRepo.save(any()) }
            }

            it("is idempotent on duplicate add — save is called and insertIgnore handles the duplicate") {
                val playerId = PlayerId.generate()
                val campaignId = CampaignId.generate()
                val campaign = makeKujiCampaign(campaignId)

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val campaignRepo = mockk<ICampaignRepository>()

                coEvery { campaignRepo.findKujiById(campaignId) } returns campaign
                // save is a no-op on duplicate via INSERT IGNORE; call twice without error
                coJustRun { favoriteRepo.save(any()) }

                val useCase = AddFavoriteUseCase(favoriteRepo, campaignRepo)
                useCase.execute(playerId, CampaignType.KUJI, campaignId)
                useCase.execute(playerId, CampaignType.KUJI, campaignId)

                coVerify(exactly = 2) { favoriteRepo.save(any()) }
            }
        }

        // -----------------------------------------------------------------------------------------
        // RemoveFavoriteUseCase
        // -----------------------------------------------------------------------------------------
        describe("RemoveFavoriteUseCase") {

            it("removes favorite successfully") {
                val playerId = PlayerId.generate()
                val campaignId = CampaignId.generate()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                coJustRun { favoriteRepo.delete(playerId.value, CampaignType.KUJI, campaignId.value) }

                val useCase = RemoveFavoriteUseCase(favoriteRepo)
                useCase.execute(playerId, CampaignType.KUJI, campaignId)

                coVerify(exactly = 1) {
                    favoriteRepo.delete(playerId.value, CampaignType.KUJI, campaignId.value)
                }
            }

            it("is idempotent when favorite does not exist — delete is a no-op") {
                val playerId = PlayerId.generate()
                val campaignId = CampaignId.generate()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                coJustRun { favoriteRepo.delete(playerId.value, CampaignType.UNLIMITED, campaignId.value) }

                val useCase = RemoveFavoriteUseCase(favoriteRepo)
                useCase.execute(playerId, CampaignType.UNLIMITED, campaignId)
                useCase.execute(playerId, CampaignType.UNLIMITED, campaignId)

                coVerify(exactly = 2) {
                    favoriteRepo.delete(playerId.value, CampaignType.UNLIMITED, campaignId.value)
                }
            }
        }

        // -----------------------------------------------------------------------------------------
        // GetFavoritesUseCase
        // -----------------------------------------------------------------------------------------
        describe("GetFavoritesUseCase") {

            it("returns favorites with campaign details") {
                val playerId = PlayerId.generate()
                val kujiId = CampaignId.generate()
                val unlimitedId = CampaignId.generate()
                val kujiCampaign = makeKujiCampaign(kujiId)
                val unlimitedCampaign = makeUnlimitedCampaign(unlimitedId)

                val favorites =
                    listOf(
                        makeFavorite(playerId, CampaignType.KUJI, kujiId),
                        makeFavorite(playerId, CampaignType.UNLIMITED, unlimitedId),
                    )

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val campaignRepo = mockk<ICampaignRepository>()

                coEvery {
                    favoriteRepo.findByPlayerId(
                        playerId = playerId.value,
                        campaignType = null,
                        limit = 20,
                        offset = 0,
                    )
                } returns favorites

                coEvery {
                    favoriteRepo.countByPlayerId(
                        playerId = playerId.value,
                        campaignType = null,
                    )
                } returns 2

                coEvery { campaignRepo.findKujiByIds(listOf(kujiId)) } returns listOf(kujiCampaign)
                coEvery { campaignRepo.findUnlimitedByIds(listOf(unlimitedId)) } returns listOf(unlimitedCampaign)

                val useCase = GetFavoritesUseCase(favoriteRepo, campaignRepo)
                val result = useCase.execute(playerId, null, page = 1, size = 20)

                result.totalCount shouldBe 2
                result.page shouldBe 1
                result.size shouldBe 20
                result.favorites shouldHaveSize 2

                val kujiDto = result.favorites.first { it.campaignType == CampaignType.KUJI }
                kujiDto.campaignId shouldBe kujiId.toString()
                kujiDto.title shouldBe kujiCampaign.title
                kujiDto.pricePerDraw shouldBe kujiCampaign.pricePerDraw
                kujiDto.status shouldBe kujiCampaign.status

                val unlimitedDto = result.favorites.first { it.campaignType == CampaignType.UNLIMITED }
                unlimitedDto.campaignId shouldBe unlimitedId.toString()
                unlimitedDto.title shouldBe unlimitedCampaign.title
                unlimitedDto.pricePerDraw shouldBe unlimitedCampaign.pricePerDraw
                unlimitedDto.status shouldBe unlimitedCampaign.status
            }

            it("returns empty list when no favorites") {
                val playerId = PlayerId.generate()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val campaignRepo = mockk<ICampaignRepository>()

                coEvery {
                    favoriteRepo.findByPlayerId(
                        playerId = playerId.value,
                        campaignType = null,
                        limit = 20,
                        offset = 0,
                    )
                } returns emptyList()

                coEvery {
                    favoriteRepo.countByPlayerId(
                        playerId = playerId.value,
                        campaignType = null,
                    )
                } returns 0

                val useCase = GetFavoritesUseCase(favoriteRepo, campaignRepo)
                val result = useCase.execute(playerId, null, page = 1, size = 20)

                result.totalCount shouldBe 0
                result.favorites.shouldBeEmpty()
                coVerify(exactly = 0) { campaignRepo.findKujiByIds(any()) }
                coVerify(exactly = 0) { campaignRepo.findUnlimitedByIds(any()) }
            }

            it("applies correct pagination offset for page 2") {
                val playerId = PlayerId.generate()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val campaignRepo = mockk<ICampaignRepository>()

                coEvery {
                    favoriteRepo.findByPlayerId(
                        playerId = playerId.value,
                        campaignType = null,
                        limit = 10,
                        offset = 10,
                    )
                } returns emptyList()

                coEvery {
                    favoriteRepo.countByPlayerId(
                        playerId = playerId.value,
                        campaignType = null,
                    )
                } returns 0

                val useCase = GetFavoritesUseCase(favoriteRepo, campaignRepo)
                useCase.execute(playerId, null, page = 2, size = 10)

                coVerify(exactly = 1) {
                    favoriteRepo.findByPlayerId(
                        playerId = playerId.value,
                        campaignType = null,
                        limit = 10,
                        offset = 10,
                    )
                }
            }

            it("filters by campaign type when specified") {
                val playerId = PlayerId.generate()
                val kujiId = CampaignId.generate()
                val kujiCampaign = makeKujiCampaign(kujiId)

                val favorites = listOf(makeFavorite(playerId, CampaignType.KUJI, kujiId))

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                val campaignRepo = mockk<ICampaignRepository>()

                coEvery {
                    favoriteRepo.findByPlayerId(
                        playerId = playerId.value,
                        campaignType = CampaignType.KUJI,
                        limit = 20,
                        offset = 0,
                    )
                } returns favorites

                coEvery {
                    favoriteRepo.countByPlayerId(
                        playerId = playerId.value,
                        campaignType = CampaignType.KUJI,
                    )
                } returns 1

                coEvery { campaignRepo.findKujiByIds(listOf(kujiId)) } returns listOf(kujiCampaign)

                val useCase = GetFavoritesUseCase(favoriteRepo, campaignRepo)
                val result = useCase.execute(playerId, CampaignType.KUJI, page = 1, size = 20)

                result.totalCount shouldBe 1
                result.favorites shouldHaveSize 1
                result.favorites.first().campaignType shouldBe CampaignType.KUJI
                coVerify(exactly = 0) { campaignRepo.findUnlimitedByIds(any()) }
            }
        }
    })
