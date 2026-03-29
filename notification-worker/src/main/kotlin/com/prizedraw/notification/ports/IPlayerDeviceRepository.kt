package com.prizedraw.notification.ports

import java.util.UUID

/** Output port for FCM device token lookups (read-only, used by [FirebaseNotificationService]). */
public interface IPlayerDeviceRepository {
    /**
     * Returns all FCM tokens registered for the given player.
     *
     * @param playerId The player's UUID.
     * @return List of FCM token strings; empty if the player has no registered devices.
     */
    public suspend fun findTokensByPlayerId(playerId: UUID): List<String>
}
