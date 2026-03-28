package com.prizedraw.domain.entities

import kotlinx.datetime.Instant
import java.util.UUID

public data class Banner(
    val id: UUID,
    val imageUrl: String,
    val linkType: String?,
    val linkUrl: String?,
    val sortOrder: Int,
    val isActive: Boolean,
    val scheduledStart: Instant?,
    val scheduledEnd: Instant?,
    val createdBy: UUID,
    val updatedBy: UUID?,
    val createdAt: Instant,
    val updatedAt: Instant,
)
