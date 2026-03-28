package com.prizedraw.integration

import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.contracts.enums.CampaignType
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import java.util.UUID

/**
 * Tests that the `isFavorited` field is correctly populated in campaign DTOs.
 *
 * These tests mirror the inline logic in [com.prizedraw.api.routes.CampaignRoutes]:
 *  - List endpoints use [ICampaignFavoriteRepository.findFavoritedCampaignIds] for an efficient
 *    batch-check, returning a `Set<UUID>` of the caller's favorited campaign IDs.
 *  - Detail endpoints use [ICampaignFavoriteRepository.isFavorited] for a single-campaign check.
 *  - Both skip the repository call when `playerId` is null (unauthenticated request).
 */
class FavoriteCampaignSyncTest :
    DescribeSpec({

        afterEach { clearAllMocks() }

        // -----------------------------------------------------------------------
        // List endpoint logic: findFavoritedCampaignIds
        // -----------------------------------------------------------------------

        describe("List endpoint: isFavorited via findFavoritedCampaignIds") {

            /**
             * Simulates the list route logic:
             * - If playerId is null, return emptySet (no DB call).
             * - Otherwise call findFavoritedCampaignIds and return the result.
             */
            suspend fun buildListDto(
                playerId: UUID?,
                campaignId: UUID,
                favoriteRepo: ICampaignFavoriteRepository,
            ): Boolean {
                val favoritedIds =
                    if (playerId != null) {
                        favoriteRepo.findFavoritedCampaignIds(
                            playerId = playerId,
                            campaignType = CampaignType.KUJI,
                            campaignIds = listOf(campaignId),
                        )
                    } else {
                        emptySet()
                    }
                val base = false
                return base.let { campaignId in favoritedIds }
            }

            it("returns isFavorited = true when campaign is in player favorites") {
                val playerId = UUID.randomUUID()
                val campaignId = UUID.randomUUID()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                coEvery {
                    favoriteRepo.findFavoritedCampaignIds(
                        playerId = playerId,
                        campaignType = CampaignType.KUJI,
                        campaignIds = listOf(campaignId),
                    )
                } returns setOf(campaignId)

                val result = buildListDto(playerId, campaignId, favoriteRepo)

                result shouldBe true
            }

            it("returns isFavorited = false when campaign is not in player favorites") {
                val playerId = UUID.randomUUID()
                val campaignId = UUID.randomUUID()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                coEvery {
                    favoriteRepo.findFavoritedCampaignIds(
                        playerId = playerId,
                        campaignType = CampaignType.KUJI,
                        campaignIds = listOf(campaignId),
                    )
                } returns emptySet()

                val result = buildListDto(playerId, campaignId, favoriteRepo)

                result shouldBe false
            }

            it("skips repository call and returns false when player is unauthenticated") {
                val campaignId = UUID.randomUUID()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()

                val result = buildListDto(playerId = null, campaignId = campaignId, favoriteRepo = favoriteRepo)

                result shouldBe false
                coVerify(exactly = 0) { favoriteRepo.findFavoritedCampaignIds(any(), any(), any()) }
            }
        }

        // -----------------------------------------------------------------------
        // Detail endpoint logic: isFavorited
        // -----------------------------------------------------------------------

        describe("Detail endpoint: isFavorited via isFavorited") {

            /**
             * Simulates the detail route logic:
             * - If playerId is null, return false (no DB call).
             * - Otherwise call isFavorited and return the result.
             */
            suspend fun buildDetailDto(
                playerId: UUID?,
                campaignId: UUID,
                favoriteRepo: ICampaignFavoriteRepository,
            ): Boolean {
                val isFavorited =
                    if (playerId != null) {
                        favoriteRepo.isFavorited(playerId, CampaignType.KUJI, campaignId)
                    } else {
                        false
                    }
                return isFavorited
            }

            it("returns isFavorited = true for authenticated player who has favorited the campaign") {
                val playerId = UUID.randomUUID()
                val campaignId = UUID.randomUUID()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                coEvery {
                    favoriteRepo.isFavorited(playerId, CampaignType.KUJI, campaignId)
                } returns true

                val result = buildDetailDto(playerId, campaignId, favoriteRepo)

                result shouldBe true
            }

            it("returns isFavorited = false for authenticated player who has not favorited the campaign") {
                val playerId = UUID.randomUUID()
                val campaignId = UUID.randomUUID()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()
                coEvery {
                    favoriteRepo.isFavorited(playerId, CampaignType.KUJI, campaignId)
                } returns false

                val result = buildDetailDto(playerId, campaignId, favoriteRepo)

                result shouldBe false
            }

            it("skips repository call and returns false when player is unauthenticated") {
                val campaignId = UUID.randomUUID()

                val favoriteRepo = mockk<ICampaignFavoriteRepository>()

                val result = buildDetailDto(playerId = null, campaignId = campaignId, favoriteRepo = favoriteRepo)

                result shouldBe false
                coVerify(exactly = 0) { favoriteRepo.isFavorited(any(), any(), any()) }
            }
        }
    })
