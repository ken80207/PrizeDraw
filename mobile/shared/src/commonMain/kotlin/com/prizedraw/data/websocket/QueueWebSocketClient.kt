package com.prizedraw.data.websocket

import com.prizedraw.contracts.endpoints.WebSocketEndpoints
import kotlinx.coroutines.flow.Flow
import kotlinx.datetime.Instant

/**
 * Sealed hierarchy of real-time events emitted by the queue WebSocket.
 */
public sealed class QueueEvent {
    /**
     * Full queue snapshot received on initial WebSocket connection.
     *
     * @property ticketBoxId The box this snapshot belongs to.
     * @property queueLength Current number of active/waiting players.
     * @property activePlayerId UUID string of the player currently drawing, or null.
     * @property sessionExpiresAt When the active player's session expires, or null.
     */
    public data class QueueSnapshot(
        val ticketBoxId: String,
        val queueLength: Int,
        val activePlayerId: String?,
        val sessionExpiresAt: Instant?,
    ) : QueueEvent()

    /**
     * Pushed whenever the queue state changes (player joined, drew, left, or session expired).
     *
     * @property ticketBoxId The box whose queue changed.
     * @property queueLength Updated queue length.
     * @property activePlayerId UUID string of the new active player, or null if idle.
     * @property sessionExpiresAt Session expiry for the new active player, or null.
     */
    public data class QueueUpdated(
        val ticketBoxId: String,
        val queueLength: Int,
        val activePlayerId: String?,
        val sessionExpiresAt: Instant?,
    ) : QueueEvent()

    /** The WebSocket connection was lost and is attempting to reconnect. */
    public data object Reconnecting : QueueEvent()

    /**
     * An error occurred on the connection.
     *
     * @property cause The underlying exception.
     */
    public data class Error(
        val cause: Throwable,
    ) : QueueEvent()
}

/**
 * Multiplatform WebSocket client for a ticket box queue room.
 *
 * Connects to [WebSocketEndpoints.QUEUE] and emits [QueueEvent] values.
 *
 * TODO(T107): Implement using Ktor Client WebSocket + kotlinx.serialization JSON parsing.
 *
 * @param baseUrl Base WebSocket URL.
 */
public class QueueWebSocketClient(
    private val baseUrl: String,
) {
    /**
     * Returns a [Flow] of [QueueEvent] for the given ticket box.
     *
     * @param ticketBoxId The ticket box to subscribe to.
     */
    public fun events(ticketBoxId: String): Flow<QueueEvent> {
        TODO(
            "T107: implement Ktor Client WS connect to $baseUrl${WebSocketEndpoints.QUEUE}" +
                " replacing {ticketBoxId} with $ticketBoxId",
        )
    }
}
