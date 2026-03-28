package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.Notification
import java.util.UUID

/** Output port for notification persistence. */
public interface INotificationRepository {
    public suspend fun save(notification: Notification): Notification

    /**
     * Persists a batch of [Notification] records using INSERT IGNORE semantics.
     *
     * Rows whose [Notification.dedupKey] already exists in the table are silently skipped,
     * making this safe to call multiple times for the same logical event.
     *
     * @param notifications The list of notifications to insert.
     */
    public suspend fun batchInsertIgnore(notifications: List<Notification>)

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
