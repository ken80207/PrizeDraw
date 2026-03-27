package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IPlayerDeviceRepository
import com.prizedraw.domain.entities.DevicePlatform
import com.prizedraw.domain.entities.PlayerDevice
import com.prizedraw.infrastructure.persistence.tables.PlayerDevicesTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.upsert
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** Exposed-backed implementation of [IPlayerDeviceRepository]. */
public class PlayerDeviceRepositoryImpl : IPlayerDeviceRepository {
    override suspend fun upsert(device: PlayerDevice): PlayerDevice =
        newSuspendedTransaction {
            PlayerDevicesTable.upsert(PlayerDevicesTable.fcmToken) {
                it[id] = device.id
                it[playerId] = device.playerId
                it[fcmToken] = device.fcmToken
                it[deviceName] = device.deviceName
                it[platform] = device.platform.name
                it[createdAt] = OffsetDateTime.ofInstant(device.createdAt.toJavaInstant(), ZoneOffset.UTC)
                it[updatedAt] = OffsetDateTime.ofInstant(device.updatedAt.toJavaInstant(), ZoneOffset.UTC)
            }
            PlayerDevicesTable
                .selectAll()
                .where { PlayerDevicesTable.fcmToken eq device.fcmToken }
                .single()
                .toPlayerDevice()
        }

    override suspend fun findTokensByPlayerId(playerId: UUID): List<String> =
        newSuspendedTransaction {
            PlayerDevicesTable
                .selectAll()
                .where { PlayerDevicesTable.playerId eq playerId }
                .map { it[PlayerDevicesTable.fcmToken] }
        }

    override suspend fun deleteByToken(fcmToken: String): Boolean =
        newSuspendedTransaction {
            val deletedRows =
                PlayerDevicesTable.deleteWhere { PlayerDevicesTable.fcmToken eq fcmToken }
            deletedRows > 0
        }

    override suspend fun deleteAllByPlayerId(playerId: UUID): Int =
        newSuspendedTransaction {
            PlayerDevicesTable.deleteWhere { PlayerDevicesTable.playerId eq playerId }
        }

    private fun ResultRow.toPlayerDevice(): PlayerDevice =
        PlayerDevice(
            id = this[PlayerDevicesTable.id],
            playerId = this[PlayerDevicesTable.playerId],
            fcmToken = this[PlayerDevicesTable.fcmToken],
            deviceName = this[PlayerDevicesTable.deviceName],
            platform = DevicePlatform.valueOf(this[PlayerDevicesTable.platform]),
            createdAt = this[PlayerDevicesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PlayerDevicesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}
