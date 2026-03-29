package com.prizedraw.realtime.ports

import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.valueobjects.CampaignId

/**
 * Reduced output port for prize definition queries needed by the realtime-gateway.
 *
 * The gateway only needs prize definitions to populate the initial board snapshot
 * sent to kuji WebSocket clients on connect.
 */
public interface IDrawRepository {
    /**
     * Returns all [PrizeDefinition]s for the given campaign, optionally filtered by type.
     *
     * @param campaignId The parent campaign identifier.
     * @param type When non-null, restricts results to definitions for this campaign type.
     * @return Ordered list of prize definitions for the campaign.
     */
    public suspend fun findDefinitionsByCampaign(
        campaignId: CampaignId,
        type: CampaignType? = null,
    ): List<PrizeDefinition>
}
