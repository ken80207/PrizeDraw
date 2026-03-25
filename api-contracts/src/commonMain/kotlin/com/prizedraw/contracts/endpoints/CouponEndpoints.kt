package com.prizedraw.contracts.endpoints

public object CouponEndpoints {
    public const val BASE: String = "/api/v1/coupons"
    public const val MY_COUPONS: String = "/api/v1/players/me/coupons"
    public const val REDEEM_CODE: String = "$BASE/redeem"
    public const val APPLY: String = "$BASE/apply"
}
