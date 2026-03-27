package com.prizedraw.contracts.dto.admin

import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.contracts.enums.WithdrawalStatus
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class AdminPlayerDto(
    val id: String,
    val nickname: String,
    val phone: String,
    val drawPointsBalance: Int,
    val revenuePointsBalance: Int,
    val isActive: Boolean,
    val createdAt: Instant,
)

@Serializable
public data class StaffDto(
    val id: String,
    val email: String,
    val name: String,
    val role: StaffRole,
    val isActive: Boolean,
    val lastLoginAt: Instant?,
)

@Serializable
public data class CreateStaffRequest(
    val email: String,
    val name: String,
    val role: StaffRole,
    val password: String,
)

@Serializable
public data class AdminCampaignListItemDto(
    val id: String,
    val title: String,
    val type: CampaignType,
    val status: CampaignStatus,
    val pricePerDraw: Int,
    val createdAt: Instant,
)

@Serializable
public data class AdminShippingOrderDto(
    val id: String,
    val prizeInstanceId: String,
    val recipientName: String,
    val recipientPhone: String,
    val addressLine1: String,
    val addressLine2: String?,
    val city: String,
    val postalCode: String,
    val countryCode: String,
    val trackingNumber: String?,
    val carrier: String?,
    val status: com.prizedraw.contracts.enums.ShippingOrderStatus,
    val shippedAt: Instant?,
    val deliveredAt: Instant?,
    val playerNickname: String,
    val playerPhone: String,
)

@Serializable
public data class AdminWithdrawalDto(
    val id: String,
    val playerNickname: String,
    val pointsAmount: Int,
    val fiatAmount: Int,
    val bankName: String,
    val status: WithdrawalStatus,
    val createdAt: Instant,
)

@Serializable
public data class AuditLogDto(
    val id: String,
    val actorType: String,
    val actorName: String,
    val action: String,
    val entityType: String,
    val entityId: String,
    val beforeValue: String?,
    val afterValue: String?,
    val createdAt: Instant,
)

@Serializable
public data class FeatureFlagDto(
    val id: String,
    val key: String,
    val enabled: Boolean,
    val targetType: String,
    val targetValue: String?,
    val description: String,
    val updatedAt: Instant,
)

// --- Phase 11: Admin Campaign Management ---

@Serializable
public data class CreateKujiTicketRangeRequest(
    val grade: String,
    val prizeName: String,
    val rangeStart: Int,
    val rangeEnd: Int,
    val prizeValue: Int = 0,
    val photoUrl: String? = null,
)

@Serializable
public data class CreateKujiBoxRequest(
    val name: String,
    val totalTickets: Int,
    val ticketRanges: List<CreateKujiTicketRangeRequest> = emptyList(),
)

@Serializable
public data class CreateKujiCampaignAdminRequest(
    val title: String,
    val description: String? = null,
    val coverImageUrl: String? = null,
    val pricePerDraw: Int,
    val drawSessionSeconds: Int = 300,
    val boxes: List<CreateKujiBoxRequest> = emptyList(),
)

@Serializable
public data class CreateUnlimitedCampaignAdminRequest(
    val title: String,
    val description: String? = null,
    val coverImageUrl: String? = null,
    val pricePerDraw: Int,
    val rateLimitPerSecond: Int = 1,
    val prizeTable: List<UnlimitedPrizeEntryRequest> = emptyList(),
)

@Serializable
public data class UpdateCampaignAdminRequest(
    val title: String? = null,
    val description: String? = null,
    val coverImageUrl: String? = null,
    val confirmProbabilityUpdate: Boolean = false,
)

@Serializable
public data class ChangeCampaignStatusRequest(
    val status: CampaignStatus,
    val confirmLowMargin: Boolean = false,
)

// --- Phase 12: Admin Pricing ---

@Serializable
public data class UpdateBuybackPriceRequest(
    val buybackPrice: Int,
    val buybackEnabled: Boolean = true,
)

@Serializable
public data class UpdateTradeFeeRateRequest(
    /** Trade fee rate in basis points (0-10000, where 10000 = 100%). */
    val tradeFeeRateBps: Int,
)

@Serializable
public data class TradeFeeRateDto(
    val tradeFeeRateBps: Int,
    val updatedAt: Instant,
)

// --- Unlimited Prize Table ---

/** A single prize entry in an unlimited campaign's probability table. */
@Serializable
public data class UnlimitedPrizeEntryRequest(
    val grade: String,
    val name: String,
    val probabilityBps: Int,
    val prizeValue: Int,
    val photoUrl: String? = null,
    val displayOrder: Int = 0,
)

/** Full replacement of an unlimited campaign's prize table. Only allowed in DRAFT status. */
@Serializable
public data class UpdatePrizeTableRequest(
    val prizeTable: List<UnlimitedPrizeEntryRequest>,
)

// --- Margin / Risk ---

/** Margin analysis result returned after create/update/status-change operations. */
@Serializable
public data class MarginResultDto(
    val totalRevenuePerUnit: Int,
    val totalCostPerUnit: Int,
    val profitPerUnit: Int,
    val marginPct: Double,
    val belowThreshold: Boolean,
    val thresholdPct: Double,
)

/** Risk settings for campaign margin validation. */
@Serializable
public data class RiskSettingsResponse(
    val marginThresholdPct: Double,
    val requireApprovalBelowThreshold: Boolean,
)

/** Request to update risk settings. */
@Serializable
public data class RiskSettingsUpdateRequest(
    val marginThresholdPct: Double? = null,
    val requireApprovalBelowThreshold: Boolean? = null,
)
