package com.prizedraw.contracts.endpoints

/** REST endpoint constants for FCM device token management. */
public object DeviceEndpoints {
    public const val BASE: String = "/api/v1/devices"
    public const val REGISTER: String = BASE

    /** Unregister uses POST with token in request body (FCM tokens contain special chars unsafe for URL paths). */
    public const val UNREGISTER: String = "$BASE/unregister"
}
