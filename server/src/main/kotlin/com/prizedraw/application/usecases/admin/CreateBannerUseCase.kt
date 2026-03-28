package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.CreateBannerCommand
import com.prizedraw.application.ports.input.admin.ICreateBannerUseCase
import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.domain.entities.Banner
import kotlinx.datetime.Clock
import java.util.UUID

public class CreateBannerUseCase(
    private val bannerRepository: IBannerRepository,
) : ICreateBannerUseCase {
    override suspend fun execute(command: CreateBannerCommand): Banner {
        require(command.imageUrl.isNotBlank()) { "Image URL must not be blank" }

        val now = Clock.System.now()
        val banner = Banner(
            id = UUID.randomUUID(),
            imageUrl = command.imageUrl.trim(),
            linkType = command.linkType?.trim(),
            linkUrl = command.linkUrl?.trim(),
            sortOrder = command.sortOrder,
            isActive = true,
            scheduledStart = command.scheduledStart,
            scheduledEnd = command.scheduledEnd,
            createdBy = command.actorStaffId.value,
            updatedBy = null,
            createdAt = now,
            updatedAt = now,
        )
        return bannerRepository.save(banner)
    }
}
