package com.prizedraw.contracts.endpoints

public object LeaderboardEndpoints {
    public const val BASE: String = "/api/v1/leaderboards"

    /**
     * Query leaderboard by type and optional period using **query parameters**.
     *
     * The server route is registered on [BASE] and expects:
     * - `type`   — [com.prizedraw.contracts.dto.leaderboard.LeaderboardType] enum value (required)
     * - `period` — [com.prizedraw.contracts.dto.leaderboard.LeaderboardPeriod] enum value (optional, defaults to ALL_TIME)
     * - `limit`  — Int (optional, defaults to 100, max 500)
     *
     * Example: `GET /api/v1/leaderboards?type=DRAW_COUNT&period=THIS_WEEK`
     */
    public const val QUERY: String = BASE

    /**
     * Path-param variant — **not implemented by the server**.
     *
     * The server handles leaderboard queries via [QUERY] (query parameters on [BASE]).
     * This constant is kept for reference only and must not be used for HTTP calls.
     */
    @Deprecated(
        message = "Server uses query params on BASE, not path params. Use QUERY instead.",
        replaceWith = ReplaceWith("LeaderboardEndpoints.QUERY"),
    )
    public const val BY_TYPE: String = "$BASE/{type}"

    /** Campaign-scoped leaderboard: `GET /api/v1/leaderboards/campaign/{campaignId}` */
    public const val CAMPAIGN_SPECIFIC: String = "$BASE/campaign/{campaignId}"
}
