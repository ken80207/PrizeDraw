package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.ApprovalStatus
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.valueobjects.CampaignId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A probability-based draw with no fixed ticket pool (無限賞活動).
 *
 * Players draw independently and simultaneously with no queuing. Prize probabilities
 * across all associated [PrizeDefinition]s must sum to exactly 1,000,000 basis points
 * (representing 100.000000%) before the campaign can be activated.
 *
 * Unlike [KujiCampaign], there is no [CampaignStatus.SOLD_OUT] state because there is
 * no ticket ceiling.
 *
 * @property id Surrogate primary key.
 * @property title Campaign display name.
 * @property description Rich-text description. Null if not set.
 * @property coverImageUrl CDN URL for cover art. Null if not set.
 * @property pricePerDraw Draw points cost per single draw. Must be positive.
 * @property rateLimitPerSecond Maximum draws per second per player. Must be >= 1.
 * @property status Current lifecycle state. Does not include SOLD_OUT.
 * @property activatedAt Timestamp of the first [CampaignStatus.ACTIVE] transition.
 * @property createdByStaffId FK to the Staff member who created this campaign.
 * @property deletedAt Soft-delete timestamp.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 * @property approvalStatus Approval gate status when margin falls below threshold.
 * @property approvedBy FK to the staff member who approved or rejected this campaign.
 * @property approvedAt Timestamp when the approval decision was recorded.
 */
public data class UnlimitedCampaign(
    val id: CampaignId,
    val title: String,
    val description: String?,
    val coverImageUrl: String?,
    val pricePerDraw: Int,
    val rateLimitPerSecond: Int,
    val status: CampaignStatus,
    val activatedAt: Instant?,
    val createdByStaffId: UUID,
    val deletedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
    val approvalStatus: ApprovalStatus = ApprovalStatus.NOT_REQUIRED,
    val approvedBy: UUID? = null,
    val approvedAt: Instant? = null,
)
