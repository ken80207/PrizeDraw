package com.prizedraw.application.ports.input.favorite

import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for removing a campaign from a player's favorites.
 *
 * The operation is idempotent: if the favorite does not exist the call is a no-op.
 */
public interface IRemoveFavoriteUseCase {
    /**
     * Removes [campaignId] of [campaignType] from [playerId]'s favorites.
     *
     * @param playerId The player removing the favorite.
     * @param campaignType The type of the campaign being un-favorited.
     * @param campaignId The campaign being un-favorited.
     */
    public suspend fun execute(
        playerId: PlayerId,
        campaignType: CampaignType,
        campaignId: CampaignId,
    )
}
