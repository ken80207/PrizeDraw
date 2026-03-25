package com.prizedraw.domain.entities

import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A single chat message sent within a campaign room.
 *
 * The [playerNickname] is denormalized at write time so that broadcast consumers
 * do not require an extra player lookup.
 *
 * Persistence is optional — primary delivery is via Redis pub/sub. The repository
 * stores messages for history retrieval only.
 *
 * @param id Unique message identifier.
 * @param roomId Room the message was sent to (e.g. `kuji:{campaignId}`).
 * @param playerId Sender's player identifier.
 * @param playerNickname Denormalized nickname for broadcast consumers.
 * @param message Text content or reaction emoji.
 * @param isReaction `true` when the message is a predefined emoji reaction.
 * @param createdAt Server-side timestamp at which the message was accepted.
 */
public data class ChatMessage(
    val id: UUID,
    val roomId: String,
    val playerId: UUID,
    val playerNickname: String?,
    val message: String,
    val isReaction: Boolean,
    val createdAt: Instant,
)
