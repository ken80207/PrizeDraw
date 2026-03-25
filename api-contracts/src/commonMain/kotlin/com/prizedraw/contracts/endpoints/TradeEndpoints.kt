package com.prizedraw.contracts.endpoints

public object TradeEndpoints {
    public const val BASE: String = "/api/v1/trade"
    public const val LISTINGS: String = "$BASE/listings"
    public const val LISTING_BY_ID: String = "$BASE/listings/{listingId}"
    public const val PURCHASE: String = "$BASE/listings/{listingId}/purchase"
}
