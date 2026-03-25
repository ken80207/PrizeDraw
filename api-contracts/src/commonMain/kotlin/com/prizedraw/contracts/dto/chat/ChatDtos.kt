package com.prizedraw.contracts.dto.chat

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

/**
 * Request body for POST `/api/v1/chat/{roomId}/messages`.
 *
 * @param message Text content. Max 100 characters.
 */
@Serializable
public data class SendMessageRequest(
    val message: String,
)

/**
 * Request body for POST `/api/v1/chat/{roomId}/reactions`.
 *
 * @param emoji Must be one of the predefined reaction emojis.
 */
@Serializable
public data class SendReactionRequest(
    val emoji: String,
)

/**
 * A single chat message returned from the history endpoint.
 *
 * @param id Unique message identifier.
 * @param playerId Sender's player ID.
 * @param playerNickname Sender's display name at the time of sending.
 * @param message Message text.
 * @param isReaction Whether this message is a reaction emoji.
 * @param createdAt Server-side timestamp.
 */
@Serializable
public data class ChatMessageDto(
    val id: String,
    val playerId: String,
    val playerNickname: String?,
    val message: String,
    val isReaction: Boolean,
    val createdAt: Instant,
)

/**
 * Response body for GET `/api/v1/chat/{roomId}/history`.
 *
 * @param roomId The chat room.
 * @param messages Messages in reverse chronological order (newest first).
 */
@Serializable
public data class ChatHistoryResponse(
    val roomId: String,
    val messages: List<ChatMessageDto>,
)
