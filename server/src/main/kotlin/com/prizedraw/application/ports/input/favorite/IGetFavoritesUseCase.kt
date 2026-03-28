package com.prizedraw.application.ports.input.favorite

import com.prizedraw.contracts.dto.favorite.FavoriteCampaignListDto
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for retrieving a paginated list of a player's favorited campaigns.
 */
public interface IGetFavoritesUseCase {
    /**
     * Returns a paginated list of campaigns favorited by [playerId].
     *
     * @param playerId The player whose favorites to retrieve.
     * @param campaignType When non-null, restricts results to this campaign type.
     * @param page 1-based page number.
     * @param size Maximum number of results per page.
     * @return Paginated list of favorited campaigns with their details.
     */
    public suspend fun execute(
        playerId: PlayerId,
        campaignType: CampaignType?,
        page: Int,
        size: Int,
    ): FavoriteCampaignListDto
}
