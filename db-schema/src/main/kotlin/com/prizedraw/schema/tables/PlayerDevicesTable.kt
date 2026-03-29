@file:Suppress("MagicNumber")

package com.prizedraw.schema.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/** Exposed table definition for `player_devices`. */
public object PlayerDevicesTable : Table("player_devices") {
    /** Surrogate primary key. */
    public val id = uuid("id").autoGenerate()

    /** FK to the player who owns this device registration. */
    public val playerId = uuid("player_id").references(PlayersTable.id)

    /** Firebase Cloud Messaging device token. Updated when the SDK rotates it. */
    public val fcmToken = varchar("fcm_token", 512)

    /** Optional human-readable label for the device, e.g. "Ken's iPhone". */
    public val deviceName = varchar("device_name", 128).nullable()

    /** Operating system / runtime environment. Maps to the DevicePlatform enum in the domain layer. */
    public val platform = varchar("platform", 32)

    /** Timestamp when this device was first registered. */
    public val createdAt = timestampWithTimeZone("created_at")

    /** Timestamp of the last token refresh. */
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
