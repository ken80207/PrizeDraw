package com.prizedraw.notification.ports

import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.valueobjects.CampaignId
import java.util.UUID

/**
 * Output port for campaign-favorite queries used during low-stock notification fan-out.
 */
public interface ICampaignFavoriteRepository {
    /**
     * Returns the player UUIDs who have favorited a specific campaign.
     *
     * Used to fan out low-stock push notifications to interested players.
     *
     * @param campaignType The campaign variant discriminator.
     * @param campaignId The campaign's strongly-typed identifier.
     * @return List of player UUIDs.
     */
    public suspend fun findPlayerIdsByCampaign(
        campaignType: CampaignType,
        campaignId: CampaignId,
    ): List<UUID>
}
