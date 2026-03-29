package com.prizedraw.notification.infrastructure.persistence

import com.prizedraw.domain.entities.Notification
import com.prizedraw.notification.ports.INotificationRepository
import com.prizedraw.schema.tables.NotificationsTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.batchInsert
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import java.time.OffsetDateTime
import java.time.ZoneOffset

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
        if (notifications.isEmpty()) {
            return
        }
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

    private fun serializeData(data: Map<String, String>): String {
        val obj = buildJsonObject { data.forEach { (k, v) -> put(k, v) } }
        return json.encodeToString(JsonObject.serializer(), obj)
    }

    private fun ResultRow.toNotification(): Notification =
        Notification(
            id = this[NotificationsTable.id],
            playerId = this[NotificationsTable.playerId],
            eventType = this[NotificationsTable.eventType],
            title = this[NotificationsTable.title],
            body = this[NotificationsTable.body],
            data =
                json
                    .parseToJsonElement(this[NotificationsTable.data])
                    .jsonObject
                    .mapValues { (_, v) -> v.jsonPrimitive.content },
            isRead = this[NotificationsTable.isRead],
            dedupKey = this[NotificationsTable.dedupKey],
            createdAt = this[NotificationsTable.createdAt].toInstant().toKotlinInstant(),
        )
}
