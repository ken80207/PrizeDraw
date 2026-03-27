package com.prizedraw.contracts.endpoints

public object PaymentEndpoints {
    public const val BASE: String = "/api/v1/payment"
    public const val PACKAGES: String = "$BASE/packages"
    public const val ORDERS: String = "$BASE/orders"
    public const val WEBHOOK: String = "$BASE/webhook/{gateway}"

    /** Development / testing only — bypasses the real payment gateway. */
    public const val MOCK_TOP_UP: String = "$BASE/mock-topup"
}
