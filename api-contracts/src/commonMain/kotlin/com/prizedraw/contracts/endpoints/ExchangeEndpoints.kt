package com.prizedraw.contracts.endpoints

public object ExchangeEndpoints {
    public const val BASE: String = "/api/v1/exchange"
    public const val OFFERS: String = "$BASE/offers"
    public const val OFFER_BY_ID: String = "$BASE/offers/{offerId}"
    public const val RESPOND: String = "$BASE/offers/{offerId}/respond"
}
