package com.prizedraw.data.remote

import com.prizedraw.contracts.dto.campaign.KujiCampaignDetailDto
import com.prizedraw.contracts.dto.campaign.KujiCampaignDto
import com.prizedraw.contracts.dto.campaign.UnlimitedCampaignDetailDto
import com.prizedraw.contracts.dto.campaign.UnlimitedCampaignDto
import com.prizedraw.contracts.dto.draw.DrawTicketDto
import com.prizedraw.contracts.endpoints.CampaignEndpoints
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get

/**
 * Remote data source for kuji and unlimited campaign queries.
 *
 * Wraps Ktor Client calls to the server [CampaignEndpoints] API. All endpoints are
 * public (no auth required) except where noted.
 *
 * @param httpClient The shared Ktor [HttpClient] instance pre-configured with
 *   base URL and JSON content negotiation via [HttpClientFactory].
 */
public class CampaignRemoteDataSource(
    private val httpClient: HttpClient,
) {
    /**
     * Fetches all active kuji campaigns.
     *
     * @return List of active [KujiCampaignDto] records.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses.
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun fetchKujiCampaigns(): List<KujiCampaignDto> =
        httpClient.get(CampaignEndpoints.KUJI_LIST).body()

    /**
     * Fetches the detail view of a single kuji campaign including boxes and prizes.
     *
     * @param campaignId The UUID of the campaign to fetch.
     * @return [KujiCampaignDetailDto] with nested boxes and prize definitions.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses.
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun fetchKujiCampaignDetail(campaignId: String): KujiCampaignDetailDto =
        httpClient.get(CampaignEndpoints.KUJI_BY_ID.replace("{campaignId}", campaignId)).body()

    /**
     * Fetches the full ticket board for a specific box.
     *
     * @param campaignId The campaign the box belongs to.
     * @param boxId The ticket box to retrieve.
     * @return Ordered list of [DrawTicketDto] for the board.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses.
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun fetchTicketBoard(
        campaignId: String,
        boxId: String,
    ): List<DrawTicketDto> =
        httpClient
            .get(
                CampaignEndpoints.KUJI_TICKET_BOARD
                    .replace("{campaignId}", campaignId)
                    .replace("{boxId}", boxId),
            ).body()

    /**
     * Fetches all active unlimited campaigns.
     *
     * @return List of active [UnlimitedCampaignDto] records.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses.
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun fetchUnlimitedCampaigns(): List<UnlimitedCampaignDto> =
        httpClient.get(CampaignEndpoints.UNLIMITED_LIST).body()

    /**
     * Fetches the detail view of a single unlimited campaign including prize definitions.
     *
     * @param campaignId The UUID of the campaign to fetch.
     * @return [UnlimitedCampaignDetailDto] with prizes and optional pity info.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses.
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun fetchUnlimitedCampaignDetail(campaignId: String): UnlimitedCampaignDetailDto =
        httpClient.get(CampaignEndpoints.UNLIMITED_BY_ID.replace("{campaignId}", campaignId)).body()
}
