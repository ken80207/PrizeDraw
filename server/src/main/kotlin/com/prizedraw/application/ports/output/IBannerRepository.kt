package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.Banner
import java.util.UUID

public interface IBannerRepository {
    public suspend fun findAllActive(): List<Banner>
    public suspend fun findAll(): List<Banner>
    public suspend fun findById(id: UUID): Banner?
    public suspend fun save(banner: Banner): Banner
    public suspend fun deactivate(id: UUID, updatedBy: UUID): Banner?
}
