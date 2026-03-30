package com.prizedraw.data.remote

import com.prizedraw.contracts.dto.trade.TradeListingPageDto
import com.prizedraw.contracts.endpoints.TradeEndpoints
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter

/**
 * Remote data source for trade marketplace queries.
 *
 * Wraps Ktor Client calls to the server [TradeEndpoints] API. All listing-read
 * endpoints are public (no auth required). Purchase and create-listing endpoints
 * require a Bearer token and are not yet implemented here.
 *
 * @param httpClient The shared Ktor [HttpClient] instance pre-configured with
 *   base URL and JSON content negotiation via [HttpClientFactory].
 */
public class TradeRemoteDataSource(
    private val httpClient: HttpClient,
) {
    /**
     * Fetches a paginated list of active trade marketplace listings.
     *
     * Maps to `GET /api/v1/trade/listings?page={page}&pageSize={pageSize}&grade={grade}
     * &minPrice={minPrice}&maxPrice={maxPrice}`.
     *
     * @param page Zero-based page index (defaults to 0).
     * @param pageSize Number of items per page (defaults to 20).
     * @param grade Optional grade filter (e.g. `A`, `LAST`). Null omits the parameter.
     * @param minPrice Optional minimum list-price filter in draw points. Null omits the parameter.
     * @param maxPrice Optional maximum list-price filter in draw points. Null omits the parameter.
     * @return [TradeListingPageDto] with items, total count, and pagination metadata.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses.
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun fetchTradeListings(
        page: Int = 0,
        pageSize: Int = 20,
        grade: String? = null,
        minPrice: Int? = null,
        maxPrice: Int? = null,
    ): TradeListingPageDto =
        httpClient
            .get(TradeEndpoints.LISTINGS) {
                parameter("page", page)
                parameter("pageSize", pageSize)
                grade?.let { parameter("grade", it) }
                minPrice?.let { parameter("minPrice", it) }
                maxPrice?.let { parameter("maxPrice", it) }
            }.body()
}
