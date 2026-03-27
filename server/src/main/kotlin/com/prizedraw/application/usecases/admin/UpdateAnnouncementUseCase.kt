package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.AnnouncementNotFoundException
import com.prizedraw.application.ports.input.admin.IUpdateAnnouncementUseCase
import com.prizedraw.application.ports.output.IServerAnnouncementRepository
import com.prizedraw.domain.entities.ServerAnnouncement
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Applies a partial update to an existing [ServerAnnouncement].
 *
 * Only non-null parameters are applied; existing values are preserved for
 * all parameters that remain null. This allows callers to, for example,
 * extend [scheduledEnd] without touching [title] or [message].
 */
public class UpdateAnnouncementUseCase(
    private val announcementRepository: IServerAnnouncementRepository,
) : IUpdateAnnouncementUseCase {
    override suspend fun execute(
        actorStaffId: StaffId,
        id: UUID,
        title: String?,
        message: String?,
        isBlocking: Boolean?,
        isActive: Boolean?,
        scheduledEnd: Instant?,
    ): ServerAnnouncement {
        val existing =
            announcementRepository.findById(id)
                ?: throw AnnouncementNotFoundException(id)

        val updated =
            existing.copy(
                title = title?.trim() ?: existing.title,
                message = message?.trim() ?: existing.message,
                isBlocking = isBlocking ?: existing.isBlocking,
                isActive = isActive ?: existing.isActive,
                scheduledEnd =
                    if (scheduledEnd != null) {
                        scheduledEnd
                    } else {
                        existing.scheduledEnd
                    },
                updatedAt = Clock.System.now(),
            )

        return announcementRepository.save(updated)
    }
}
