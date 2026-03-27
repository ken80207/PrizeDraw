package com.prizedraw.application.services

import com.prizedraw.application.ports.output.IChatRepository
import com.prizedraw.domain.entities.ChatMessage
import com.prizedraw.infrastructure.external.redis.RedisClient
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import kotlinx.coroutines.future.await
import kotlinx.datetime.Clock
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Thrown when a player exceeds the per-room chat rate limit.
 *
 * @param message Human-readable reason.
 */
public class RateLimitExceededException(
    message: String,
) : RuntimeException(message)

/**
 * Sealed hierarchy of chat WebSocket events broadcast to room participants.
 */
@Serializable
public sealed class ChatEvent {
    /** A text message sent by a player. */
    @Serializable
    @SerialName("CHAT_MESSAGE")
    public data class Message(
        val playerId: String,
        val nickname: String,
        val message: String,
        val timestamp: String,
    ) : ChatEvent()

    /** An emoji reaction sent by a player. */
    @Serializable
    @SerialName("CHAT_REACTION")
    public data class Reaction(
        val playerId: String,
        val nickname: String,
        val emoji: String,
        val timestamp: String,
    ) : ChatEvent()
}

/**
 * Application service managing real-time chat within campaign rooms.
 *
 * Room identifiers follow the convention:
 * - `kuji:{campaignId}` for kuji campaign rooms.
 * - `unlimited:{campaignId}:{broadcasterId}` for unlimited-draw broadcast rooms.
 *
 * Messages are persisted via [IChatRepository] for history retrieval and broadcast
 * in real time via [RedisPubSub] for cross-pod fanout to all connected WebSocket sessions.
 *
 * Rate limiting is enforced using a Redis INCR counter with a 1-second TTL. Each
 * player is allowed at most [RATE_LIMIT_PER_SECOND] messages per [RATE_LIMIT_WINDOW_MS].
 *
 * @param chatRepository Persistence for chat history.
 * @param redisPubSub Pub/sub bus for real-time broadcast.
 * @param redisClient Redis connection pool used for rate-limit counters.
 */
public class ChatService(
    private val chatRepository: IChatRepository,
    private val redisPubSub: RedisPubSub,
    private val redisClient: RedisClient,
) {
    private val log = LoggerFactory.getLogger(ChatService::class.java)
    private val json = Json { encodeDefaults = true }

    /** Predefined emoji reactions players may send. */
    public val allowedReactions: Set<String> =
        setOf(
            "\uD83C\uDF89", // 🎉
            "\uD83D\uDE31", // 😱
            "\uD83D\uDC4F", // 👏
            "\uD83D\uDD25", // 🔥
            "\uD83D\uDCAA", // 💪
            "\uD83D\uDE02", // 😂
            "\u2764\uFE0F", // ❤️
            "\uD83C\uDF8A", // 🎊
            "\uD83D\uDE0D", // 😍
            "\uD83E\uDD29", // 🤩
        )

    /** Patterns for content that should be filtered. Loaded from config in production. */
    private val bannedPatterns: List<Regex> = emptyList()

    /**
     * Sends a text message to [roomId] on behalf of [playerId].
     *
     * Validates length, enforces rate limiting, sanitizes content, persists the message,
     * and broadcasts it via Redis pub/sub.
     *
     * @param roomId Destination room.
     * @param playerId Sender identifier.
     * @param nickname Sender display name (denormalized into the persisted record).
     * @param message Raw message text from the client.
     * @throws IllegalArgumentException if the message is blank or exceeds [MAX_MESSAGE_LENGTH].
     * @throws RateLimitExceededException if the player has exceeded the rate limit.
     */
    public suspend fun sendMessage(
        roomId: String,
        playerId: UUID,
        nickname: String,
        message: String,
    ) {
        require(message.isNotBlank()) { "Message cannot be blank" }
        require(message.length <= MAX_MESSAGE_LENGTH) {
            "Message exceeds $MAX_MESSAGE_LENGTH characters"
        }
        enforceRateLimit(roomId, playerId)
        val sanitized = sanitize(message)
        val chatMessage = buildChatMessage(roomId, playerId, nickname, sanitized, isReaction = false)
        chatRepository.save(chatMessage)
        val event =
            ChatEvent.Message(
                playerId = playerId.toString(),
                nickname = nickname,
                message = sanitized,
                timestamp = chatMessage.createdAt.toString(),
            )
        redisPubSub.publish("chat:$roomId", json.encodeToString<ChatEvent>(event))
        log.debug("Chat message sent: room=$roomId player=$playerId")
    }

    /**
     * Sends an emoji reaction to [roomId].
     *
     * Reactions are rate-limited but not persisted — they are broadcast-only.
     *
     * @param roomId Destination room.
     * @param playerId Sender identifier.
     * @param nickname Sender display name.
     * @param emoji Must be one of [allowedReactions].
     * @throws IllegalArgumentException if [emoji] is not in [allowedReactions].
     * @throws RateLimitExceededException if the player has exceeded the rate limit.
     */
    public suspend fun sendReaction(
        roomId: String,
        playerId: UUID,
        nickname: String,
        emoji: String,
    ) {
        require(emoji in allowedReactions) { "Invalid reaction: $emoji" }
        enforceRateLimit(roomId, playerId)
        val now = Clock.System.now()
        val event =
            ChatEvent.Reaction(
                playerId = playerId.toString(),
                nickname = nickname,
                emoji = emoji,
                timestamp = now.toString(),
            )
        redisPubSub.publish("chat:$roomId", json.encodeToString<ChatEvent>(event))
    }

    /**
     * Returns up to [limit] recent messages for [roomId].
     *
     * @param roomId The room to query.
     * @param limit Maximum messages to return (clamped to [MIN_HISTORY_LIMIT]–[MAX_HISTORY_LIMIT]).
     * @return Messages in reverse chronological order.
     */
    public suspend fun getHistory(
        roomId: String,
        limit: Int = DEFAULT_HISTORY_LIMIT,
    ): List<ChatMessage> = chatRepository.findByRoom(roomId, limit.coerceIn(MIN_HISTORY_LIMIT, MAX_HISTORY_LIMIT))

    // --- Private helpers ---

    private suspend fun enforceRateLimit(
        roomId: String,
        playerId: UUID,
    ) {
        val key = "chat:ratelimit:$roomId:$playerId"
        val count =
            redisClient.withConnection { commands ->
                val incr = commands.incr(key).await()
                if (incr == 1L) {
                    commands.pexpire(key, RATE_LIMIT_WINDOW_MS).await()
                }
                incr
            }
        if (count > RATE_LIMIT_PER_SECOND) {
            throw RateLimitExceededException(
                "Chat rate limit exceeded for player $playerId in room $roomId",
            )
        }
    }

    private fun sanitize(message: String): String =
        bannedPatterns.fold(message.trim()) { acc, pattern ->
            acc.replace(pattern, "***")
        }

    private fun buildChatMessage(
        roomId: String,
        playerId: UUID,
        nickname: String,
        message: String,
        isReaction: Boolean,
    ): ChatMessage =
        ChatMessage(
            id = UUID.randomUUID(),
            roomId = roomId,
            playerId = playerId,
            playerNickname = nickname,
            message = message,
            isReaction = isReaction,
            createdAt = Clock.System.now(),
        )

    public companion object {
        /** Maximum allowed length for a single chat message. */
        public const val MAX_MESSAGE_LENGTH: Int = 100

        /** Maximum messages allowed per player within [RATE_LIMIT_WINDOW_MS]. */
        public const val RATE_LIMIT_PER_SECOND: Int = 2

        /** Rate-limit window duration in milliseconds. */
        public const val RATE_LIMIT_WINDOW_MS: Long = 1_000L

        /** Default number of history messages returned when no limit is specified. */
        public const val DEFAULT_HISTORY_LIMIT: Int = 50

        /** Minimum number of history messages that can be requested. */
        public const val MIN_HISTORY_LIMIT: Int = 1

        /** Maximum number of history messages that can be requested. */
        public const val MAX_HISTORY_LIMIT: Int = 100
    }
}
