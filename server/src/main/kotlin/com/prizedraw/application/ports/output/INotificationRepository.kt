package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.Notification
import java.util.UUID

/** Output port for notification persistence. */
public interface INotificationRepository {
    public suspend fun save(notification: Notification): Notification

    public suspend fun findByPlayerId(
        playerId: UUID,
        limit: Int = 20,
        offset: Int = 0,
    ): List<Notification>

    public suspend fun markRead(
        id: UUID,
        playerId: UUID,
    ): Boolean

    public suspend fun markAllRead(playerId: UUID): Int

    public suspend fun countUnread(playerId: UUID): Int
}
