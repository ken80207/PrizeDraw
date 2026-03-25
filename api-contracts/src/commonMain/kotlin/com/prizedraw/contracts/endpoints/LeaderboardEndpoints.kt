package com.prizedraw.contracts.endpoints

public object LeaderboardEndpoints {
    public const val BASE: String = "/api/v1/leaderboards"
    public const val BY_TYPE: String = "$BASE/{type}"
    public const val CAMPAIGN_SPECIFIC: String = "$BASE/campaign/{campaignId}"
}
