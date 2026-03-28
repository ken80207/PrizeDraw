package com.prizedraw.data.remote

import com.prizedraw.contracts.dto.banner.BannerDto
import com.prizedraw.contracts.endpoints.BannerEndpoints
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get

/**
 * Remote data source for the public banner carousel endpoint.
 *
 * Fetches the ordered list of active banners to display in the campaign list screen.
 *
 * @param httpClient The shared Ktor [HttpClient] instance (injected via Koin/DI).
 */
public class BannerRemoteDataSource(
    private val httpClient: HttpClient,
) {
    /**
     * Fetches the current list of active banners.
     *
     * @return List of [BannerDto] sorted by [BannerDto.sortOrder].
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses.
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun fetchBanners(): List<BannerDto> = httpClient.get(BannerEndpoints.BANNERS).body()
}
