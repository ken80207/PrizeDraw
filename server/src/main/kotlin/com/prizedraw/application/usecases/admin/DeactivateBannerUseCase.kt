package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.BannerNotFoundException
import com.prizedraw.application.ports.input.admin.IDeactivateBannerUseCase
import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.domain.entities.Banner
import com.prizedraw.domain.valueobjects.StaffId
import java.util.UUID

public class DeactivateBannerUseCase(
    private val bannerRepository: IBannerRepository,
) : IDeactivateBannerUseCase {
    override suspend fun execute(
        actorStaffId: StaffId,
        id: UUID,
    ): Banner =
        bannerRepository.deactivate(id, actorStaffId.value)
            ?: throw BannerNotFoundException(id)
}
