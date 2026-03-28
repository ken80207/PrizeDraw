package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.domain.entities.Notification
import com.prizedraw.infrastructure.persistence.inTransaction
import com.prizedraw.infrastructure.persistence.tables.NotificationsTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.batchInsert
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** Exposed-backed implementation of [INotificationRepository]. */
public class NotificationRepositoryImpl : INotificationRepository {
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun save(notification: Notification): Notification =
        inTransaction {
            NotificationsTable.insert {
                it[id] = notification.id
                it[playerId] = notification.playerId
                it[eventType] = notification.eventType
                it[title] = notification.title
                it[body] = notification.body
                it[data] = serializeData(notification.data)
                it[isRead] = notification.isRead
                it[dedupKey] = notification.dedupKey
                it[createdAt] = OffsetDateTime.ofInstant(notification.createdAt.toJavaInstant(), ZoneOffset.UTC)
            }
            NotificationsTable
                .selectAll()
                .where { NotificationsTable.id eq notification.id }
                .single()
                .toNotification()
        }

    override suspend fun batchInsertIgnore(notifications: List<Notification>) {
        if (notifications.isEmpty()) return
        inTransaction {
            NotificationsTable.batchInsert(notifications, ignore = true) { n ->
                this[NotificationsTable.id] = n.id
                this[NotificationsTable.playerId] = n.playerId
                this[NotificationsTable.eventType] = n.eventType
                this[NotificationsTable.title] = n.title
                this[NotificationsTable.body] = n.body
                this[NotificationsTable.data] = serializeData(n.data)
                this[NotificationsTable.isRead] = n.isRead
                this[NotificationsTable.dedupKey] = n.dedupKey
                this[NotificationsTable.createdAt] =
                    OffsetDateTime.ofInstant(n.createdAt.toJavaInstant(), ZoneOffset.UTC)
            }
        }
    }

    override suspend fun findByPlayerId(
        playerId: UUID,
        limit: Int,
        offset: Int,
    ): List<Notification> =
        inTransaction {
            NotificationsTable
                .selectAll()
                .where { NotificationsTable.playerId eq playerId }
                .orderBy(NotificationsTable.createdAt, SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toNotification() }
        }

    override suspend fun markRead(
        id: UUID,
        playerId: UUID,
    ): Boolean =
        inTransaction {
            val updatedRows =
                NotificationsTable.update({
                    (NotificationsTable.id eq id) and
                        (NotificationsTable.playerId eq playerId) and
                        (NotificationsTable.isRead eq false)
                }) {
                    it[isRead] = true
                }
            updatedRows > 0
        }

    override suspend fun markAllRead(playerId: UUID): Int =
        inTransaction {
            NotificationsTable.update({
                (NotificationsTable.playerId eq playerId) and
                    (NotificationsTable.isRead eq false)
            }) {
                it[isRead] = true
            }
        }

    override suspend fun countUnread(playerId: UUID): Int =
        inTransaction {
            NotificationsTable
                .selectAll()
                .where {
                    (NotificationsTable.playerId eq playerId) and
                        (NotificationsTable.isRead eq false)
                }.count()
                .toInt()
        }

    private fun serializeData(data: Map<String, String>): String {
        val obj = buildJsonObject { data.forEach { (k, v) -> put(k, v) } }
        return json.encodeToString(
            kotlinx.serialization.json.JsonObject
                .serializer(),
            obj
        )
    }

    private fun deserializeData(raw: String): Map<String, String> =
        json
            .parseToJsonElement(raw)
            .jsonObject
            .mapValues { (_, v) -> v.jsonPrimitive.content }

    private fun ResultRow.toNotification(): Notification =
        Notification(
            id = this[NotificationsTable.id],
            playerId = this[NotificationsTable.playerId],
            eventType = this[NotificationsTable.eventType],
            title = this[NotificationsTable.title],
            body = this[NotificationsTable.body],
            data = deserializeData(this[NotificationsTable.data]),
            isRead = this[NotificationsTable.isRead],
            dedupKey = this[NotificationsTable.dedupKey],
            createdAt = this[NotificationsTable.createdAt].toInstant().toKotlinInstant(),
        )
}
