package com.prizedraw.contracts.endpoints

public object ShippingEndpoints {
    public const val BASE: String = "/api/v1/shipping"
    public const val ORDERS: String = "$BASE/orders"
    public const val ORDER_BY_ID: String = "$BASE/orders/{orderId}"
    public const val ORDER_TRACKING: String = "$BASE/orders/{orderId}/tracking"
    public const val CONFIRM_DELIVERY: String = "$BASE/orders/{orderId}/confirm-delivery"
}
