package com.prizedraw.contracts.dto.campaign

import com.prizedraw.contracts.dto.grade.CampaignGradeDto
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.TicketBoxStatus
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class KujiCampaignDto(
    val id: String,
    val title: String,
    val description: String? = null,
    val coverImageUrl: String? = null,
    val pricePerDraw: Int,
    val drawSessionSeconds: Int,
    val status: CampaignStatus,
    val activatedAt: Instant?,
    val soldOutAt: Instant?,
    val isFavorited: Boolean = false,
)

@Serializable
public data class UnlimitedCampaignDto(
    val id: String,
    val title: String,
    val description: String? = null,
    val coverImageUrl: String? = null,
    val pricePerDraw: Int,
    val rateLimitPerSecond: Int,
    val status: CampaignStatus,
    val activatedAt: Instant?,
    val isFavorited: Boolean = false,
)

@Serializable
public data class TicketBoxDto(
    val id: String,
    val name: String,
    val totalTickets: Int,
    val remainingTickets: Int,
    val status: TicketBoxStatus,
    val displayOrder: Int,
)

@Serializable
public data class PrizeDefinitionDto(
    val id: String,
    val grade: String,
    val name: String,
    val photos: List<String>,
    val prizeValue: Int,
    val buybackPrice: Int,
    val buybackEnabled: Boolean,
    val probabilityBps: Int?,
    val ticketCount: Int?,
    val displayOrder: Int,
    val campaignGradeId: String? = null,
    val campaignGrade: CampaignGradeDto? = null,
)

@Serializable
public data class CreateKujiCampaignRequest(
    val title: String,
    val description: String,
    val coverImageUrl: String,
    val pricePerDraw: Int,
    val drawSessionSeconds: Int,
)

@Serializable
public data class CreateUnlimitedCampaignRequest(
    val title: String,
    val description: String,
    val coverImageUrl: String,
    val pricePerDraw: Int,
    val rateLimitPerSecond: Int,
)

@Serializable
public data class UpdateCampaignStatusRequest(
    val status: CampaignStatus,
)

@Serializable
public data class KujiCampaignDetailDto(
    val campaign: KujiCampaignDto,
    val boxes: List<TicketBoxDto>,
    val prizes: List<PrizeDefinitionDto>,
    val grades: List<CampaignGradeDto> = emptyList(),
)

@Serializable
public data class UnlimitedCampaignDetailDto(
    val campaign: UnlimitedCampaignDto,
    val prizes: List<PrizeDefinitionDto>,
    val grades: List<CampaignGradeDto> = emptyList(),
)
