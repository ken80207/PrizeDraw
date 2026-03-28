package com.prizedraw.contracts.endpoints

public object FavoriteEndpoints {
    public const val BASE: String = "/api/v1/players/me/favorites"
    public const val LIST: String = BASE
    public const val ADD: String = "$BASE/{campaignType}/{campaignId}"
    public const val REMOVE: String = "$BASE/{campaignType}/{campaignId}"
}
