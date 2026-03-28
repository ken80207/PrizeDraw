package com.prizedraw.application.ports.input.favorite

import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for adding a campaign to a player's favorites.
 *
 * The operation is idempotent: if the favorite already exists the call is a no-op.
 */
public interface IAddFavoriteUseCase {
    /**
     * Adds [campaignId] of [campaignType] to [playerId]'s favorites.
     *
     * @param playerId The player adding the favorite.
     * @param campaignType The type of the campaign being favorited.
     * @param campaignId The campaign being favorited.
     * @throws IllegalArgumentException if the campaign does not exist.
     */
    public suspend fun execute(
        playerId: PlayerId,
        campaignType: CampaignType,
        campaignId: CampaignId,
    )
}
