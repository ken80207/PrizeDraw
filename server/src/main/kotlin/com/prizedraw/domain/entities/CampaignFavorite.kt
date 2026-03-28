package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Instant

public data class CampaignFavorite(
    val playerId: PlayerId,
    val campaignType: CampaignType,
    val campaignId: CampaignId,
    val createdAt: Instant,
)
