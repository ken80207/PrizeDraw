package com.prizedraw.application.ports.input.admin

import com.prizedraw.domain.entities.ServerAnnouncement
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Input port for updating an existing [ServerAnnouncement].
 *
 * Only provided (non-null) fields are mutated. This enables partial updates
 * such as extending the [scheduledEnd] without touching the message.
 */
public interface IUpdateAnnouncementUseCase {
    /**
     * Applies a partial update to the announcement identified by [id].
     *
     * @param actorStaffId Staff member performing the update.
     * @param id UUID of the announcement to update.
     * @param title New headline, or null to leave unchanged.
     * @param message New body text, or null to leave unchanged.
     * @param isBlocking Updated blocking flag, or null to leave unchanged.
     * @param isActive Updated active flag, or null to leave unchanged.
     * @param scheduledEnd Updated expected end time, or null to leave unchanged.
     * @return The updated [ServerAnnouncement].
     * @throws AnnouncementNotFoundException when no announcement with [id] exists.
     */
    public suspend fun execute(
        actorStaffId: StaffId,
        id: UUID,
        title: String?,
        message: String?,
        isBlocking: Boolean?,
        isActive: Boolean?,
        scheduledEnd: Instant?,
    ): ServerAnnouncement
}
