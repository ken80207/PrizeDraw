package com.prizedraw.realtime.infrastructure.persistence

import com.prizedraw.realtime.ports.INotificationRepository
import com.prizedraw.schema.tables.NotificationsTable
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/**
 * Exposed-backed implementation of [INotificationRepository] for the realtime-gateway.
 *
 * Only exposes the read operations required by the player notification WebSocket handler.
 */
public class NotificationRepositoryImpl : INotificationRepository {
    override suspend fun countUnread(playerId: UUID): Int =
        newSuspendedTransaction {
            NotificationsTable
                .selectAll()
                .where {
                    (NotificationsTable.playerId eq playerId) and
                        (NotificationsTable.isRead eq false)
                }.count()
                .toInt()
        }
}
