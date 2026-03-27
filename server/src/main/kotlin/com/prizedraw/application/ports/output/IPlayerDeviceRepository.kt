package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.PlayerDevice
import java.util.UUID

/** Output port for FCM device token persistence. */
public interface IPlayerDeviceRepository {
    public suspend fun upsert(device: PlayerDevice): PlayerDevice

    public suspend fun findTokensByPlayerId(playerId: UUID): List<String>

    public suspend fun deleteByToken(fcmToken: String): Boolean

    public suspend fun deleteAllByPlayerId(playerId: UUID): Int
}
