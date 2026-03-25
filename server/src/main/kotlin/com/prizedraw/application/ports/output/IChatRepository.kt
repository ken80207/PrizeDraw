package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.ChatMessage
import kotlinx.datetime.Instant

/**
 * Persistence port for [ChatMessage].
 *
 * Chat messages are primarily delivered in real time via Redis pub/sub; this repository
 * provides optional persistence for history retrieval and automated cleanup.
 */
public interface IChatRepository {
    /**
     * Persists a new chat message and returns the saved entity.
     *
     * @param message The message to save.
     * @return The saved message with any server-assigned fields populated.
     */
    public suspend fun save(message: ChatMessage): ChatMessage

    /**
     * Returns up to [limit] messages for [roomId] in reverse chronological order.
     *
     * @param roomId The chat room identifier.
     * @param limit Maximum number of messages to return. Defaults to 50.
     * @param before Optional cursor — only return messages created before this instant.
     * @return Messages ordered newest-first.
     */
    public suspend fun findByRoom(
        roomId: String,
        limit: Int = 50,
        before: Instant? = null,
    ): List<ChatMessage>

    /**
     * Deletes all messages created before [cutoff] and returns the number deleted.
     *
     * Intended for use by a periodic cleanup job to enforce the 7-day retention policy.
     *
     * @param cutoff Messages older than this instant are deleted.
     * @return Count of deleted rows.
     */
    public suspend fun deleteOlderThan(cutoff: Instant): Int
}
