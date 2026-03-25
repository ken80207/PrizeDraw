package com.prizedraw.data.remote

import com.prizedraw.contracts.dto.campaign.KujiCampaignDetailDto
import com.prizedraw.contracts.dto.campaign.KujiCampaignDto
import com.prizedraw.contracts.dto.draw.DrawTicketDto
import com.prizedraw.contracts.endpoints.CampaignEndpoints

/**
 * Remote data source for kuji campaign queries.
 *
 * Wraps Ktor Client calls to the server [CampaignEndpoints] API.
 *
 * TODO(T107): Replace stubs with actual Ktor Client implementation.
 */
public class CampaignRemoteDataSource {
    // TODO(T107): inject HttpClient

    /**
     * Fetches all active kuji campaigns.
     *
     * @return List of active [KujiCampaignDto] records.
     */
    public suspend fun fetchKujiCampaigns(): List<KujiCampaignDto> {
        TODO("T107: implement Ktor Client GET to ${CampaignEndpoints.KUJI_LIST}")
    }

    /**
     * Fetches the detail view of a single kuji campaign including boxes and prizes.
     *
     * @param campaignId The UUID of the campaign to fetch.
     * @return [KujiCampaignDetailDto] with nested boxes and prize definitions.
     */
    public suspend fun fetchKujiCampaignDetail(campaignId: String): KujiCampaignDetailDto {
        TODO("T107: implement Ktor Client GET to ${CampaignEndpoints.KUJI_BY_ID}")
    }

    /**
     * Fetches the full ticket board for a specific box.
     *
     * @param campaignId The campaign the box belongs to.
     * @param boxId The ticket box to retrieve.
     * @return Ordered list of [DrawTicketDto] for the board.
     */
    public suspend fun fetchTicketBoard(
        campaignId: String,
        boxId: String,
    ): List<DrawTicketDto> {
        TODO("T107: implement Ktor Client GET to ${CampaignEndpoints.KUJI_TICKET_BOARD}")
    }
}
