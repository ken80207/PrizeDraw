package com.prizedraw.application.ports.input.admin

import com.prizedraw.domain.entities.ServerAnnouncement
import com.prizedraw.domain.valueobjects.StaffId
import java.util.UUID

/**
 * Input port for deactivating (soft-deleting) a [ServerAnnouncement].
 *
 * Deactivated announcements are excluded from the public status response
 * but retained in the database for audit purposes.
 */
public interface IDeactivateAnnouncementUseCase {
    /**
     * Marks the announcement identified by [id] as inactive.
     *
     * @param actorStaffId Staff member performing the deactivation.
     * @param id UUID of the announcement to deactivate.
     * @return The deactivated [ServerAnnouncement].
     * @throws AnnouncementNotFoundException when no announcement with [id] exists.
     */
    public suspend fun execute(
        actorStaffId: StaffId,
        id: UUID,
    ): ServerAnnouncement
}

/** Thrown when an operation targets an announcement that does not exist. */
public class AnnouncementNotFoundException(
    id: UUID,
) : NoSuchElementException("Announcement '$id' not found")
