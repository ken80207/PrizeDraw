package com.prizedraw.data.remote

import com.prizedraw.contracts.dto.leaderboard.LeaderboardDto
import com.prizedraw.contracts.dto.leaderboard.LeaderboardPeriod
import com.prizedraw.contracts.dto.leaderboard.LeaderboardType
import com.prizedraw.contracts.endpoints.LeaderboardEndpoints
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.parameter

/**
 * Remote data source for leaderboard queries.
 *
 * Wraps Ktor Client calls to the server [LeaderboardEndpoints] API. All leaderboard
 * queries are public (no auth required). The self-rank field in the response is
 * populated by the server when the request carries a valid Bearer token, but absence
 * of auth does not fail the call.
 *
 * @param httpClient The shared Ktor [HttpClient] instance pre-configured with
 *   base URL and JSON content negotiation via [HttpClientFactory].
 */
public class LeaderboardRemoteDataSource(
    private val httpClient: HttpClient,
) {
    /**
     * Fetches the leaderboard for a given [type] and [period].
     *
     * Maps to `GET /api/v1/leaderboards?type={type}&period={period}&limit={limit}`.
     *
     * @param type The leaderboard metric to display (e.g. [LeaderboardType.DRAW_COUNT]).
     * @param period The time window to aggregate over (defaults to [LeaderboardPeriod.ALL_TIME]).
     * @param limit Maximum number of entries to return (defaults to 100, server max 500).
     * @return [LeaderboardDto] containing ranked entries and optional self-rank.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses.
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun fetchLeaderboard(
        type: LeaderboardType,
        period: LeaderboardPeriod = LeaderboardPeriod.ALL_TIME,
        limit: Int = 100,
    ): LeaderboardDto =
        httpClient
            .get(LeaderboardEndpoints.QUERY) {
                parameter("type", type.name)
                parameter("period", period.name)
                parameter("limit", limit)
            }.body()
}
