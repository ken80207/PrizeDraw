package com.prizedraw.contracts.endpoints

/** REST and WebSocket endpoint constants for the chat subsystem. */
public object ChatEndpoints {
    public const val BASE: String = "/api/v1/chat"

    /** POST — Send a text message to a room. Requires authentication. */
    public const val SEND_MESSAGE: String = "$BASE/{roomId}/messages"

    /** POST — Send an emoji reaction to a room. Requires authentication. */
    public const val SEND_REACTION: String = "$BASE/{roomId}/reactions"

    /** GET — Retrieve recent chat history for a room. */
    public const val HISTORY: String = "$BASE/{roomId}/history"
}
