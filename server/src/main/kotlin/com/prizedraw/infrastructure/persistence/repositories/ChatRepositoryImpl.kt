package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IChatRepository
import com.prizedraw.domain.entities.ChatMessage
import com.prizedraw.infrastructure.persistence.tables.ChatMessagesTable
import kotlinx.datetime.Instant
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * Exposed implementation of [IChatRepository].
 */
public class ChatRepositoryImpl : IChatRepository {
    override suspend fun save(message: ChatMessage): ChatMessage =
        newSuspendedTransaction {
            ChatMessagesTable.insert {
                it[id] = message.id
                it[roomId] = message.roomId
                it[playerId] = message.playerId
                it[ChatMessagesTable.message] = message.message
                it[isReaction] = message.isReaction
                it[createdAt] = OffsetDateTime.ofInstant(message.createdAt.toJavaInstant(), ZoneOffset.UTC)
            }
            message
        }

    override suspend fun findByRoom(
        roomId: String,
        limit: Int,
        before: Instant?,
    ): List<ChatMessage> =
        newSuspendedTransaction {
            val query =
                ChatMessagesTable
                    .selectAll()
                    .where {
                        val roomFilter = ChatMessagesTable.roomId eq roomId
                        if (before != null) {
                            val beforeOffset = OffsetDateTime.ofInstant(before.toJavaInstant(), ZoneOffset.UTC)
                            roomFilter and (ChatMessagesTable.createdAt less beforeOffset)
                        } else {
                            roomFilter
                        }
                    }.orderBy(ChatMessagesTable.createdAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                    .limit(limit)
            query.map { it.toChatMessage() }
        }

    override suspend fun deleteOlderThan(cutoff: Instant): Int =
        newSuspendedTransaction {
            val cutoffOffset = OffsetDateTime.ofInstant(cutoff.toJavaInstant(), ZoneOffset.UTC)
            ChatMessagesTable.deleteWhere {
                createdAt less cutoffOffset
            }
        }

    private fun ResultRow.toChatMessage(): ChatMessage =
        ChatMessage(
            id = this[ChatMessagesTable.id],
            roomId = this[ChatMessagesTable.roomId],
            playerId = this[ChatMessagesTable.playerId],
            playerNickname = null, // nickname not stored in the table — denormalized at write time only
            message = this[ChatMessagesTable.message],
            isReaction = this[ChatMessagesTable.isReaction],
            createdAt = this[ChatMessagesTable.createdAt].toInstant().toKotlinInstant(),
        )
}
