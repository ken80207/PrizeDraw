package com.prizedraw.application.usecases.favorite

import com.prizedraw.application.ports.input.favorite.IGetFavoritesUseCase
import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.contracts.dto.favorite.FavoriteCampaignDto
import com.prizedraw.contracts.dto.favorite.FavoriteCampaignListDto
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.CampaignFavorite
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Returns a paginated, decorated list of campaigns that a player has favorited.
 *
 * Favorites are fetched first, then their corresponding campaign entities are
 * batch-loaded in two queries (one per campaign type present in the page) to avoid
 * N+1 database access.
 */
public class GetFavoritesUseCase(
    private val favoriteRepository: ICampaignFavoriteRepository,
    private val campaignRepository: ICampaignRepository,
) : IGetFavoritesUseCase {

    override suspend fun execute(
        playerId: PlayerId,
        campaignType: CampaignType?,
        page: Int,
        size: Int,
    ): FavoriteCampaignListDto {
        val offset = (page - 1) * size

        val favorites =
            favoriteRepository.findByPlayerId(
                playerId = playerId.value,
                campaignType = campaignType,
                limit = size,
                offset = offset,
            )

        val totalCount =
            favoriteRepository.countByPlayerId(
                playerId = playerId.value,
                campaignType = campaignType,
            )

        val (kujiRefs, unlimitedRefs) = favorites.partition { it.campaignType == CampaignType.KUJI }

        val kujiById =
            if (kujiRefs.isNotEmpty()) {
                campaignRepository
                    .findKujiByIds(kujiRefs.map { CampaignId(it.campaignId.value) })
                    .associateBy { it.id.value }
            } else {
                emptyMap()
            }

        val unlimitedById =
            if (unlimitedRefs.isNotEmpty()) {
                campaignRepository
                    .findUnlimitedByIds(unlimitedRefs.map { CampaignId(it.campaignId.value) })
                    .associateBy { it.id.value }
            } else {
                emptyMap()
            }

        val favoriteDtos =
            favorites.mapNotNull { favorite ->
                toDto(favorite, kujiById, unlimitedById)
            }

        return FavoriteCampaignListDto(
            favorites = favoriteDtos,
            totalCount = totalCount,
            page = page,
            size = size,
        )
    }

    private fun toDto(
        favorite: CampaignFavorite,
        kujiById: Map<java.util.UUID, com.prizedraw.domain.entities.KujiCampaign>,
        unlimitedById: Map<java.util.UUID, com.prizedraw.domain.entities.UnlimitedCampaign>,
    ): FavoriteCampaignDto? =
        when (favorite.campaignType) {
            CampaignType.KUJI -> {
                val campaign = kujiById[favorite.campaignId.value] ?: return null
                FavoriteCampaignDto(
                    campaignType = CampaignType.KUJI,
                    campaignId = campaign.id.toString(),
                    title = campaign.title,
                    coverImageUrl = campaign.coverImageUrl,
                    pricePerDraw = campaign.pricePerDraw,
                    status = campaign.status,
                    favoritedAt = favorite.createdAt,
                )
            }
            CampaignType.UNLIMITED -> {
                val campaign = unlimitedById[favorite.campaignId.value] ?: return null
                FavoriteCampaignDto(
                    campaignType = CampaignType.UNLIMITED,
                    campaignId = campaign.id.toString(),
                    title = campaign.title,
                    coverImageUrl = campaign.coverImageUrl,
                    pricePerDraw = campaign.pricePerDraw,
                    status = campaign.status,
                    favoritedAt = favorite.createdAt,
                )
            }
        }
}
