package com.prizedraw.domain.entities

import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A platform-wide announcement managed by staff and consumed by all clients.
 *
 * Announcements cover three categories:
 * - **MAINTENANCE** — planned or emergency downtime. When [isBlocking] is true,
 *   clients must display a full-screen overlay that cannot be dismissed.
 * - **ANNOUNCEMENT** — non-critical informational notice surfaced as a dismissible banner.
 * - **UPDATE_REQUIRED** — instructs mobile clients to install a newer app version.
 *
 * The public `/api/v1/status` endpoint aggregates all active announcements whose
 * [scheduledEnd] has not yet passed and whose [targetPlatforms] match the requesting
 * client, then derives the overall [ServerStatus] from the presence of any blocking entry.
 *
 * @property id Surrogate primary key.
 * @property type Announcement category.
 * @property title Short headline shown to users (localised by the creating staff member).
 * @property message Detailed body text.
 * @property isActive Master on/off switch; deactivated announcements are excluded from the
 *   public status response.
 * @property isBlocking When true, clients must render a full-screen blocking overlay.
 * @property targetPlatforms Set of platform identifiers this announcement applies to.
 *   Recognised values: `WEB`, `ANDROID`, `IOS`, `ALL`. An empty set defaults to `ALL`.
 * @property minAppVersion Minimum required version string recorded for UPDATE_REQUIRED notices.
 * @property scheduledStart Optional future activation time; if in the future, the announcement
 *   is not yet shown to clients.
 * @property scheduledEnd Optional expected resolution time displayed to users.
 * @property createdByStaffId FK to the [Staff] member who created this record.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class ServerAnnouncement(
    val id: UUID,
    val type: AnnouncementEntityType,
    val title: String,
    val message: String,
    val isActive: Boolean,
    val isBlocking: Boolean,
    val targetPlatforms: List<String>,
    val minAppVersion: String?,
    val scheduledStart: Instant?,
    val scheduledEnd: Instant?,
    val createdByStaffId: UUID?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/**
 * Domain-level announcement type classification.
 *
 * Mapped to the API-contracts [com.prizedraw.contracts.dto.status.AnnouncementType] in the
 * route layer to keep the domain free of serialization concerns.
 */
public enum class AnnouncementEntityType {
    MAINTENANCE,
    ANNOUNCEMENT,
    UPDATE_REQUIRED,
}
