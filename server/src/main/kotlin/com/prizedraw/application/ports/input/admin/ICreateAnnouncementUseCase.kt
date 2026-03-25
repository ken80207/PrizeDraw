package com.prizedraw.application.ports.input.admin

import com.prizedraw.domain.entities.AnnouncementEntityType
import com.prizedraw.domain.entities.ServerAnnouncement
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Instant

/**
 * Parameters for creating a new server announcement.
 *
 * Introduced as a command object to keep [ICreateAnnouncementUseCase.execute] under
 * the detekt `LongParameterList` threshold.
 *
 * @property actorStaffId Staff member creating the announcement.
 * @property type Announcement category.
 * @property title Short headline.
 * @property message Detailed body text.
 * @property isBlocking Whether this announcement prevents all platform interactions.
 * @property targetPlatforms Platforms this announcement applies to.
 * @property minAppVersion Minimum required app version string (for UPDATE_REQUIRED type).
 * @property scheduledStart Optional future activation timestamp.
 * @property scheduledEnd Optional expected resolution timestamp.
 */
public data class CreateAnnouncementCommand(
    val actorStaffId: StaffId,
    val type: AnnouncementEntityType,
    val title: String,
    val message: String,
    val isBlocking: Boolean,
    val targetPlatforms: List<String>,
    val minAppVersion: String?,
    val scheduledStart: Instant?,
    val scheduledEnd: Instant?,
)

/**
 * Input port for creating a new [ServerAnnouncement].
 *
 * Requires the calling staff member's ID for audit attribution.
 * OPERATOR role or above is sufficient to create informational announcements;
 * ADMIN or above is required for blocking maintenance notices.
 */
public interface ICreateAnnouncementUseCase {
    /**
     * Creates and persists a new server announcement.
     *
     * @param command All parameters required to create the announcement.
     * @return The persisted [ServerAnnouncement].
     */
    public suspend fun execute(command: CreateAnnouncementCommand): ServerAnnouncement
}
