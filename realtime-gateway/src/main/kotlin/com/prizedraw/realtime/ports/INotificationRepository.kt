package com.prizedraw.realtime.ports

import java.util.UUID

/**
 * Reduced output port for notification queries needed by the realtime-gateway.
 *
 * Only exposes the operations required for the player notification WebSocket handler.
 * Full notification persistence remains in the Core API.
 */
public interface INotificationRepository {
    /**
     * Returns the number of unread notifications for [playerId].
     *
     * Sent to the client on WebSocket connect as the initial unread badge count.
     *
     * @param playerId The player whose unread count is queried.
     * @return Number of unread notifications.
     */
    public suspend fun countUnread(playerId: UUID): Int
}
