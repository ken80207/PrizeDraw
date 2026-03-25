package com.prizedraw.game.protocol

import com.prizedraw.game.model.GameRoomState
import com.prizedraw.game.state.GameRoomEvent
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonClassDiscriminator

// ---------------------------------------------------------------------------
// Client → Server messages
// ---------------------------------------------------------------------------

/**
 * All messages that a game-room client can send to the server.
 *
 * Serialised as a discriminated union with a `kind` discriminator field so that
 * both Kotlin (via `kotlinx.serialization`) and TypeScript/JS consumers can decode
 * the same JSON envelope.
 */
@OptIn(ExperimentalSerializationApi::class)
@JsonClassDiscriminator("kind")
@Serializable
public sealed class ClientToServerMessage {
    /** Request the character to path-find toward an isometric tile. */
    @Serializable
    @SerialName("Move")
    public data class Move(
        val targetIsoX: Float,
        val targetIsoY: Float,
    ) : ClientToServerMessage()

    /** Join the draw queue for a specific ticket box. */
    @Serializable
    @SerialName("JoinQueue")
    public data class JoinQueue(
        val ticketBoxId: String,
    ) : ClientToServerMessage()

    /** Leave the current queue. */
    @Serializable
    @SerialName("LeaveQueue")
    public data class LeaveQueue(
        val placeholder: Boolean = false,
    ) : ClientToServerMessage()

    /** Send a chat message visible to all room participants. */
    @Serializable
    @SerialName("Chat")
    public data class Chat(
        val message: String,
    ) : ClientToServerMessage()

    /** Send a quick emoji reaction. */
    @Serializable
    @SerialName("React")
    public data class React(
        val emoji: String,
    ) : ClientToServerMessage()

    /** Request a full [GameRoomState] snapshot from the server. */
    @Serializable
    @SerialName("RequestState")
    public data class RequestState(
        val placeholder: Boolean = false,
    ) : ClientToServerMessage()
}

// ---------------------------------------------------------------------------
// Server → Client messages
// ---------------------------------------------------------------------------

/**
 * All messages that the server can push to a connected game-room client.
 */
@OptIn(ExperimentalSerializationApi::class)
@JsonClassDiscriminator("kind")
@Serializable
public sealed class ServerToClientMessage {
    /** Full room snapshot, typically sent once on join or on [ClientToServerMessage.RequestState]. */
    @Serializable
    @SerialName("RoomSnapshot")
    public data class RoomSnapshot(
        val state: GameRoomState,
    ) : ServerToClientMessage()

    /** A single incremental [GameRoomEvent] to be applied by the client's reducer. */
    @Serializable
    @SerialName("Event")
    public data class Event(
        val event: GameRoomEvent,
    ) : ServerToClientMessage()

    /** An error message from the server (invalid action, rate-limit exceeded, etc.). */
    @Serializable
    @SerialName("Error")
    public data class Error(
        val code: String,
        val message: String,
    ) : ServerToClientMessage()
}

// ---------------------------------------------------------------------------
// Codec
// ---------------------------------------------------------------------------

/**
 * JSON codec for the WebSocket message protocol used by the game room.
 *
 * Uses a lenient [Json] configuration with class discriminators so that messages
 * survive minor schema drift (e.g. unknown enum values in newer server versions).
 */
public object GameRoomCodec {
    private val json =
        Json {
            // Use "kind" as the polymorphic discriminator to avoid conflicts with
            // data-model properties that are also named "type" (e.g. BubbleShown.type).
            classDiscriminator = "kind"
            ignoreUnknownKeys = true
            encodeDefaults = true
            isLenient = true
        }

    /**
     * Encodes a [ClientToServerMessage] to a JSON string.
     *
     * @param msg The message to encode.
     * @return JSON representation.
     */
    public fun encodeC2S(msg: ClientToServerMessage): String =
        json.encodeToString(ClientToServerMessage.serializer(), msg)

    /**
     * Decodes a JSON string into a [ClientToServerMessage].
     *
     * @param json Raw JSON from the WebSocket frame.
     * @return The decoded message.
     * @throws kotlinx.serialization.SerializationException if the JSON is malformed or
     *   the type discriminator is missing/unknown.
     */
    public fun decodeC2S(json: String): ClientToServerMessage =
        this.json.decodeFromString(ClientToServerMessage.serializer(), json)

    /**
     * Encodes a [ServerToClientMessage] to a JSON string.
     *
     * @param msg The message to encode.
     * @return JSON representation.
     */
    public fun encodeS2C(msg: ServerToClientMessage): String =
        json.encodeToString(ServerToClientMessage.serializer(), msg)

    /**
     * Decodes a JSON string into a [ServerToClientMessage].
     *
     * @param json Raw JSON from the WebSocket frame.
     * @return The decoded message.
     * @throws kotlinx.serialization.SerializationException if the JSON is malformed or
     *   the type discriminator is missing/unknown.
     */
    public fun decodeS2C(json: String): ServerToClientMessage =
        this.json.decodeFromString(ServerToClientMessage.serializer(), json)
}
