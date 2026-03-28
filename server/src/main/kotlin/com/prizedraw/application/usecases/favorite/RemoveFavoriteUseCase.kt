package com.prizedraw.application.usecases.favorite

import com.prizedraw.application.ports.input.favorite.IRemoveFavoriteUseCase
import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Removes a campaign from a player's favorites.
 *
 * If the favorite does not exist the operation is a no-op, making it idempotent.
 */
public class RemoveFavoriteUseCase(
    private val favoriteRepository: ICampaignFavoriteRepository,
) : IRemoveFavoriteUseCase {

    override suspend fun execute(
        playerId: PlayerId,
        campaignType: CampaignType,
        campaignId: CampaignId,
    ) {
        favoriteRepository.delete(
            playerId = playerId.value,
            campaignType = campaignType,
            campaignId = campaignId.value,
        )
    }
}
