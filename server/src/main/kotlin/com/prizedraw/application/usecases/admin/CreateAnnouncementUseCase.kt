package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.CreateAnnouncementCommand
import com.prizedraw.application.ports.input.admin.ICreateAnnouncementUseCase
import com.prizedraw.application.ports.output.IServerAnnouncementRepository
import com.prizedraw.domain.entities.ServerAnnouncement
import kotlinx.datetime.Clock
import java.util.UUID

/**
 * Creates a new server announcement and persists it via [IServerAnnouncementRepository].
 *
 * [CreateAnnouncementCommand.targetPlatforms] defaults to `["ALL"]` when the caller
 * passes an empty list, ensuring the announcement reaches every client platform.
 */
public class CreateAnnouncementUseCase(
    private val announcementRepository: IServerAnnouncementRepository,
) : ICreateAnnouncementUseCase {
    override suspend fun execute(command: CreateAnnouncementCommand): ServerAnnouncement {
        require(command.title.isNotBlank()) { "Announcement title must not be blank" }
        require(command.message.isNotBlank()) { "Announcement message must not be blank" }

        val now = Clock.System.now()
        val resolvedPlatforms = command.targetPlatforms.ifEmpty { listOf("ALL") }

        val announcement =
            ServerAnnouncement(
                id = UUID.randomUUID(),
                type = command.type,
                title = command.title.trim(),
                message = command.message.trim(),
                isActive = true,
                isBlocking = command.isBlocking,
                targetPlatforms = resolvedPlatforms,
                minAppVersion = command.minAppVersion,
                scheduledStart = command.scheduledStart,
                scheduledEnd = command.scheduledEnd,
                createdByStaffId = command.actorStaffId.value,
                createdAt = now,
                updatedAt = now,
            )

        return announcementRepository.save(announcement)
    }
}
