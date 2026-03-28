package com.prizedraw.contracts.dto.banner

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class BannerDto(
    val id: String,
    val imageUrl: String,
    val linkType: String? = null,
    val linkUrl: String? = null,
    val sortOrder: Int,
    val isActive: Boolean,
    val scheduledStart: Instant? = null,
    val scheduledEnd: Instant? = null,
)

@Serializable
public data class CreateBannerRequest(
    val imageUrl: String,
    val linkType: String? = null,
    val linkUrl: String? = null,
    val sortOrder: Int = 0,
    val scheduledStart: Instant? = null,
    val scheduledEnd: Instant? = null,
)

@Serializable
public data class UpdateBannerRequest(
    val imageUrl: String? = null,
    val linkType: String? = null,
    val linkUrl: String? = null,
    val sortOrder: Int? = null,
    val isActive: Boolean? = null,
    val scheduledStart: Instant? = null,
    val scheduledEnd: Instant? = null,
)
