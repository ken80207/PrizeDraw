package com.prizedraw.contracts.endpoints

/** API endpoint constants for the follow system. */
public object FollowEndpoints {
    public const val FOLLOW: String = "/api/v1/follows/{playerId}"
    public const val FOLLOWING_LIST: String = "/api/v1/follows/following"
    public const val FOLLOWERS_LIST: String = "/api/v1/follows/followers"
    public const val FOLLOW_STATUS: String = "/api/v1/follows/{playerId}/status"
    public const val BATCH_FOLLOW_STATUS: String = "/api/v1/follows/batch-status"
    public const val SEARCH_BY_CODE: String = "/api/v1/players/search"
}
