package com.prizedraw.contracts.endpoints

public object WithdrawalEndpoints {
    public const val BASE: String = "/api/v1/withdrawals"
    public const val LIST: String = BASE
    public const val CREATE: String = BASE
    public const val BY_ID: String = "$BASE/{withdrawalId}"
}
