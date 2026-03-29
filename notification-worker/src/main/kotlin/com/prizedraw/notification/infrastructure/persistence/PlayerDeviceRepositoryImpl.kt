package com.prizedraw.notification.infrastructure.persistence

import com.prizedraw.notification.ports.IPlayerDeviceRepository
import com.prizedraw.schema.tables.PlayerDevicesTable
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/** Exposed-backed implementation of [IPlayerDeviceRepository] (read-only FCM token lookup). */
public class PlayerDeviceRepositoryImpl : IPlayerDeviceRepository {
    override suspend fun findTokensByPlayerId(playerId: UUID): List<String> =
        newSuspendedTransaction {
            PlayerDevicesTable
                .selectAll()
                .where { PlayerDevicesTable.playerId eq playerId }
                .map { it[PlayerDevicesTable.fcmToken] }
        }
}
