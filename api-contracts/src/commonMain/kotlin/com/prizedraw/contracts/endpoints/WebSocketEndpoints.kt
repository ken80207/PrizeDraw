package com.prizedraw.contracts.endpoints

public object WebSocketEndpoints {
    public const val KUJI_ROOM: String = "/ws/kuji/{campaignId}"
    public const val QUEUE: String = "/ws/queue/{ticketBoxId}"

    /** WebSocket for real-time chat; room key mirrors the REST `{roomId}` path parameter. */
    public const val CHAT_ROOM: String = "/ws/chat/{roomId}"
}
