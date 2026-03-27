package com.prizedraw.domain.entities

import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A registered FCM device token for push notification delivery.
 *
 * Each player may register multiple devices. Tokens are refreshed by the client SDK
 * and updated in place; stale tokens are pruned after delivery failure.
 *
 * @property id Surrogate primary key.
 * @property playerId The player who owns this device registration.
 * @property fcmToken Firebase Cloud Messaging device token. Updated when the SDK rotates it.
 * @property deviceName Optional human-readable label for the device (e.g. "Ken's iPhone").
 * @property platform The operating system / runtime environment of the device.
 * @property createdAt Timestamp when this device was first registered.
 * @property updatedAt Timestamp of the last token refresh.
 */
public data class PlayerDevice(
    val id: UUID = UUID.randomUUID(),
    val playerId: UUID,
    val fcmToken: String,
    val deviceName: String? = null,
    val platform: DevicePlatform,
    val createdAt: Instant = Clock.System.now(),
    val updatedAt: Instant = Clock.System.now(),
)

/** The operating system / runtime environment of a registered [PlayerDevice]. */
public enum class DevicePlatform {
    /** Google Android. */
    ANDROID,

    /** Apple iOS. */
    IOS,

    /** Browser-based Web Push. */
    WEB,
}
