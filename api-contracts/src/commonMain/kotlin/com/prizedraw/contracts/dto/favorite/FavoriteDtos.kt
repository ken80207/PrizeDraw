package com.prizedraw.contracts.dto.favorite

import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class FavoriteCampaignDto(
    val campaignType: CampaignType,
    val campaignId: String,
    val title: String,
    val coverImageUrl: String? = null,
    val pricePerDraw: Int,
    val status: CampaignStatus,
    val favoritedAt: Instant,
)

@Serializable
public data class FavoriteCampaignListDto(
    val favorites: List<FavoriteCampaignDto>,
    val totalCount: Int,
    val page: Int,
    val size: Int,
)
