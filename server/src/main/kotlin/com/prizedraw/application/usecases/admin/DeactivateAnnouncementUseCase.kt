package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.AnnouncementNotFoundException
import com.prizedraw.application.ports.input.admin.IDeactivateAnnouncementUseCase
import com.prizedraw.application.ports.output.IServerAnnouncementRepository
import com.prizedraw.domain.entities.ServerAnnouncement
import com.prizedraw.domain.valueobjects.StaffId
import java.util.UUID

/**
 * Deactivates a [ServerAnnouncement] so it no longer appears in the public status feed.
 *
 * The record is soft-deleted (marked inactive) rather than physically removed,
 * preserving the audit history.
 */
public class DeactivateAnnouncementUseCase(
    private val announcementRepository: IServerAnnouncementRepository,
) : IDeactivateAnnouncementUseCase {
    override suspend fun execute(
        actorStaffId: StaffId,
        id: UUID,
    ): ServerAnnouncement =
        announcementRepository.deactivate(id)
            ?: throw AnnouncementNotFoundException(id)
}
