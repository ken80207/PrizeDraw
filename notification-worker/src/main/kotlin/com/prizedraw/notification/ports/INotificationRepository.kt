package com.prizedraw.notification.ports

import com.prizedraw.domain.entities.Notification

/** Output port for notification persistence. */
public interface INotificationRepository {
    /**
     * Persists a single [Notification] record.
     *
     * @param notification The notification to persist.
     * @return The persisted notification.
     */
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
}
