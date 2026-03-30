package com.prizedraw.data.remote

import com.prizedraw.contracts.dto.prize.PrizeInstanceDto
import com.prizedraw.contracts.endpoints.PlayerEndpoints
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get

/**
 * Remote data source for the authenticated player's prize inventory.
 *
 * Wraps Ktor Client calls to [PlayerEndpoints.ME_PRIZES]. The endpoint requires
 * authentication; without a Bearer token the server may return an empty list or
 * a 401 response depending on server configuration.
 *
 * Auth header injection is intentionally deferred until the token store is wired
 * (TODO T125). For now the call goes out without a token and the UI gracefully
 * handles an empty result.
 *
 * @param httpClient The shared Ktor [HttpClient] instance pre-configured with
 *   base URL and JSON content negotiation via [HttpClientFactory].
 */
public class PrizeRemoteDataSource(
    private val httpClient: HttpClient,
) {
    /**
     * Fetches the authenticated player's prize inventory.
     *
     * Maps to `GET /api/v1/players/me/prizes`.
     *
     * @return List of [PrizeInstanceDto] owned by the current player.
     *   Returns an empty list when the player has no prizes or is unauthenticated.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses.
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun fetchMyPrizes(): List<PrizeInstanceDto> =
        httpClient.get(PlayerEndpoints.ME_PRIZES).body()
}
