package com.prizedraw.contracts.endpoints

public object DrawEndpoints {
    public const val BASE: String = "/api/v1/draws"
    public const val DRAW_KUJI: String = "$BASE/kuji"
    public const val DRAW_UNLIMITED: String = "$BASE/unlimited"
    public const val TICKETS_BY_BOX: String = "$BASE/ticket-boxes/{boxId}/tickets"

    // Queue management
    public const val QUEUE_JOIN: String = "$BASE/kuji/queue/join"
    public const val QUEUE_LEAVE: String = "$BASE/kuji/queue/leave"
    public const val QUEUE_SWITCH_BOX: String = "$BASE/kuji/queue/switch-box"

    // Draw sync (gameification — spectator anti-spoiler relay)
    public const val SYNC_PROGRESS: String = "$BASE/sync/progress"
    public const val SYNC_CANCEL: String = "$BASE/sync/cancel"
    public const val SYNC_COMPLETE: String = "$BASE/sync/complete"
}
