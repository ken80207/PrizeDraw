package com.prizedraw.contracts.dto.status

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

/**
 * Top-level response from the public `/api/v1/status` endpoint.
 *
 * All clients (web, mobile, admin, CS) poll this endpoint on startup and periodically.
 * When [status] is [ServerStatus.MAINTENANCE] and any active announcement has
 * `isBlocking = true`, clients must render a blocking maintenance screen.
 *
 * @property status Overall platform availability.
 * @property serverTime Current server UTC timestamp (useful for clock-skew detection).
 * @property announcements Active announcements ordered by creation date descending.
 * @property minAppVersion Minimum required app versions per platform (null = no minimum enforced).
 */
@Serializable
public data class ServerStatusResponse(
    val status: ServerStatus,
    val serverTime: Instant,
    val announcements: List<AnnouncementDto>,
    val minAppVersion: MinAppVersion? = null,
)

/**
 * Overall server availability state.
 *
 * - [ONLINE]: Platform is fully operational.
 * - [MAINTENANCE]: At least one active blocking maintenance announcement exists.
 */
@Serializable
public enum class ServerStatus {
    ONLINE,
    MAINTENANCE,
}

/**
 * A single platform announcement surfaced to clients.
 *
 * @property id Announcement UUID.
 * @property type Classification of this announcement.
 * @property title Short human-readable summary (localised for the target market).
 * @property message Detailed explanation shown to users.
 * @property isBlocking When true, clients must prevent interaction until resolved.
 * @property scheduledStart Optional start time; null means the announcement is already active.
 * @property scheduledEnd Optional expected resolution time shown to users.
 */
@Serializable
public data class AnnouncementDto(
    val id: String,
    val type: AnnouncementType,
    val title: String,
    val message: String,
    val isBlocking: Boolean,
    val scheduledStart: Instant? = null,
    val scheduledEnd: Instant? = null,
)

/**
 * Classification of a server announcement.
 *
 * - [MAINTENANCE]: Planned or unplanned downtime.
 * - [ANNOUNCEMENT]: Informational notice (new feature, event, etc.).
 * - [UPDATE_REQUIRED]: Clients must update their app to continue.
 */
@Serializable
public enum class AnnouncementType {
    MAINTENANCE,
    ANNOUNCEMENT,
    UPDATE_REQUIRED,
}

/**
 * Minimum app versions required per mobile platform.
 *
 * When the client's running version is lower than the applicable floor version,
 * it should surface an [AnnouncementType.UPDATE_REQUIRED] prompt.
 *
 * @property android Minimum required version string for Android (semver, e.g. `"1.2.0"`).
 * @property ios Minimum required version string for iOS.
 */
@Serializable
public data class MinAppVersion(
    val android: String? = null,
    val ios: String? = null,
)

/**
 * Request body for creating a new server announcement (admin only).
 *
 * @property type Classification of the announcement.
 * @property title Short summary displayed as the headline.
 * @property message Detailed body text.
 * @property isBlocking When true, the announcement prevents all platform interactions.
 * @property targetPlatforms Which platforms see this announcement (`WEB`, `ANDROID`, `IOS`, or `ALL`).
 * @property minAppVersion If set, records the minimum required app version string.
 * @property scheduledStart Optional ISO-8601 timestamp when this announcement becomes active.
 * @property scheduledEnd Optional ISO-8601 timestamp when the situation is expected to resolve.
 */
@Serializable
public data class CreateAnnouncementRequest(
    val type: AnnouncementType,
    val title: String,
    val message: String,
    val isBlocking: Boolean = false,
    val targetPlatforms: List<String> = listOf("ALL"),
    val minAppVersion: String? = null,
    val scheduledStart: Instant? = null,
    val scheduledEnd: Instant? = null,
)

/**
 * Request body for updating an existing server announcement (admin only).
 *
 * All fields are optional; only provided fields are mutated.
 *
 * @property title Updated headline.
 * @property message Updated body text.
 * @property isBlocking Updated blocking flag.
 * @property isActive Whether the announcement should remain active.
 * @property scheduledEnd Updated expected end time.
 */
@Serializable
public data class UpdateAnnouncementRequest(
    val title: String? = null,
    val message: String? = null,
    val isBlocking: Boolean? = null,
    val isActive: Boolean? = null,
    val scheduledEnd: Instant? = null,
)
