package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.BannerNotFoundException
import com.prizedraw.application.ports.input.admin.IUpdateBannerUseCase
import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.domain.entities.Banner
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import java.util.UUID

public class UpdateBannerUseCase(
    private val bannerRepository: IBannerRepository,
) : IUpdateBannerUseCase {
    override suspend fun execute(
        actorStaffId: StaffId,
        id: UUID,
        imageUrl: String?,
        linkType: String?,
        linkUrl: String?,
        sortOrder: Int?,
        isActive: Boolean?,
        scheduledStart: Instant?,
        scheduledEnd: Instant?,
    ): Banner {
        val existing = bannerRepository.findById(id)
            ?: throw BannerNotFoundException(id)

        val updated = existing.copy(
            imageUrl = imageUrl?.trim() ?: existing.imageUrl,
            linkType = linkType ?: existing.linkType,
            linkUrl = linkUrl ?: existing.linkUrl,
            sortOrder = sortOrder ?: existing.sortOrder,
            isActive = isActive ?: existing.isActive,
            scheduledStart = scheduledStart ?: existing.scheduledStart,
            scheduledEnd = scheduledEnd ?: existing.scheduledEnd,
            updatedBy = actorStaffId.value,
            updatedAt = Clock.System.now(),
        )
        return bannerRepository.save(updated)
    }
}
