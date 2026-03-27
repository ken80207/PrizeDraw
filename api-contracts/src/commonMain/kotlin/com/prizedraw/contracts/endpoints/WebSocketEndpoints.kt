package com.prizedraw.contracts.endpoints

public object WebSocketEndpoints {
    /**
     * Legacy single-shard kuji room. Kept for backwards compatibility.
     * New clients should connect to [KUJI_ROOM_SHARDED] which includes a `roomInstanceId`.
     */
    public const val KUJI_ROOM: String = "/ws/kuji/{campaignId}"

    /**
     * Sharded kuji room introduced in Phase 21.
     *
     * The `roomInstanceId` is obtained from the `S2C_ROOM_ASSIGNED` event on the
     * legacy endpoint, or from `GET /api/v1/campaigns/kuji/{campaignId}/rooms`.
     * Draw events are broadcast campaign-wide; chat is scoped to the shard.
     */
    public const val KUJI_ROOM_SHARDED: String = "/ws/kuji/{campaignId}/rooms/{roomInstanceId}"

    public const val QUEUE: String = "/ws/queue/{ticketBoxId}"

    /** WebSocket for real-time chat; room key mirrors the REST `{roomId}` path parameter. */
    public const val CHAT_ROOM: String = "/ws/chat/{roomId}"

    /**
     * Per-player notification channel. Requires JWT access token as query param `token`.
     *
     * Note: The token will appear in server access logs (query strings are typically logged).
     * Short-lived access tokens (15 min) mitigate the risk. Consider configuring
     * Ktor/reverse-proxy log filters to redact the `token` query param in production.
     */
    public const val PLAYER_NOTIFICATIONS: String = "/ws/player/notifications"
}
