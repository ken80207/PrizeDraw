package com.prizedraw.data.websocket

import com.prizedraw.contracts.endpoints.WebSocketEndpoints
import kotlinx.coroutines.flow.Flow

/**
 * Sealed hierarchy of real-time events emitted by the kuji board WebSocket.
 */
public sealed class KujiRoomEvent {
    /**
     * Full board snapshot received on initial WebSocket connection.
     *
     * @property campaignId The campaign this snapshot belongs to.
     * @property rawJson The raw JSON payload for progressive parsing.
     */
    public data class BoardSnapshot(
        val campaignId: String,
        val rawJson: String,
    ) : KujiRoomEvent()

    /**
     * Pushed when a ticket is drawn by any player in the room.
     *
     * @property campaignId The campaign.
     * @property ticketBoxId The box the ticket belongs to.
     * @property drawnByNickname Display name of the player who drew.
     * @property ticketCount Number of tickets drawn in this batch.
     */
    public data class TicketDrawn(
        val campaignId: String,
        val ticketBoxId: String,
        val drawnByNickname: String,
        val ticketCount: Int,
    ) : KujiRoomEvent()

    /** The WebSocket connection was lost and is attempting to reconnect. */
    public data object Reconnecting : KujiRoomEvent()

    /**
     * An error occurred on the WebSocket connection.
     *
     * @property cause The underlying exception.
     */
    public data class Error(
        val cause: Throwable,
    ) : KujiRoomEvent()
}

/**
 * Multiplatform WebSocket client for the kuji draw room.
 *
 * Connects to [WebSocketEndpoints.KUJI_ROOM] and emits [KujiRoomEvent] values via a
 * cold [Flow]. The flow remains active until the caller cancels the collection or the
 * WebSocket disconnects permanently.
 *
 * TODO(T107): Implement using Ktor Client WebSocket + kotlinx.serialization JSON parsing.
 *   Configure exponential backoff reconnect on [KujiRoomEvent.Reconnecting].
 *
 * @param baseUrl Base WebSocket URL, e.g. `wss://api.prizedraw.com`.
 */
public class KujiWebSocketClient(
    private val baseUrl: String,
) {
    /**
     * Returns a [Flow] of [KujiRoomEvent] for the given campaign room.
     *
     * The flow connects lazily on first collection and disconnects on cancellation.
     *
     * @param campaignId The campaign to subscribe to.
     */
    public fun events(campaignId: String): Flow<KujiRoomEvent> {
        TODO(
            "T107: implement Ktor Client WS connect to $baseUrl${WebSocketEndpoints.KUJI_ROOM}" +
                " replacing {campaignId} with $campaignId — emit KujiRoomEvent.BoardSnapshot on connect," +
                " KujiRoomEvent.TicketDrawn on each draw message",
        )
    }
}
