package com.prizedraw.application.ports.input.admin

import com.prizedraw.domain.entities.Banner
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Instant
import java.util.UUID

public data class CreateBannerCommand(
    val actorStaffId: StaffId,
    val imageUrl: String,
    val linkType: String?,
    val linkUrl: String?,
    val sortOrder: Int,
    val scheduledStart: Instant?,
    val scheduledEnd: Instant?,
)

public interface ICreateBannerUseCase {
    public suspend fun execute(command: CreateBannerCommand): Banner
}

public interface IUpdateBannerUseCase {
    public suspend fun execute(
        actorStaffId: StaffId,
        id: UUID,
        imageUrl: String?,
        linkType: String?,
        linkUrl: String?,
        sortOrder: Int?,
        isActive: Boolean?,
        scheduledStart: Instant?,
        scheduledEnd: Instant?,
    ): Banner
}

public interface IDeactivateBannerUseCase {
    public suspend fun execute(actorStaffId: StaffId, id: UUID): Banner
}

public class BannerNotFoundException(id: UUID) : NoSuchElementException("Banner '$id' not found")
