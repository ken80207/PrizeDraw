package com.prizedraw.contracts.endpoints

public object FeatureFlagEndpoints {
    public const val BASE: String = "/api/v1/feature-flags"
    public const val LIST: String = BASE
    public const val BY_KEY: String = "$BASE/{key}"
}
