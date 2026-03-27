package com.prizedraw.contracts.endpoints

/** REST endpoint constants for the notification subsystem. */
public object NotificationEndpoints {
    public const val BASE: String = "/api/v1/notifications"
    public const val LIST: String = BASE
    public const val UNREAD_COUNT: String = "$BASE/unread-count"
    public const val MARK_READ: String = "$BASE/{id}/read"
    public const val MARK_ALL_READ: String = "$BASE/read-all"
}
