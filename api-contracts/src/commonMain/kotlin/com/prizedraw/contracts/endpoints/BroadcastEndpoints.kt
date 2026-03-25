package com.prizedraw.contracts.endpoints

/** REST endpoint constants for the broadcast session subsystem. */
public object BroadcastEndpoints {
    public const val BASE: String = "/api/v1/broadcast"

    /** POST — Start a live broadcast. Requires authentication. */
    public const val START: String = "$BASE/start"

    /** POST — Stop the caller's active broadcast. Requires authentication. */
    public const val STOP: String = "$BASE/stop"

    /** GET — List active broadcasts; filter by `?campaignId=`. */
    public const val ACTIVE: String = "$BASE/active"
}
