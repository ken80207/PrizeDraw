package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.ApprovalStatus
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.valueobjects.CampaignId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A finite, queue-based draw event (一番賞活動).
 *
 * Used by the low-stock notification worker to query ticket counts and mark
 * campaigns as notified. The full campaign lifecycle is managed by the Core API.
 *
 * @property id Surrogate primary key.
 * @property title Campaign display name.
 * @property description Rich-text description. Null if not set.
 * @property coverImageUrl CDN URL for campaign cover art. Null if not set.
 * @property pricePerDraw Draw points cost per single draw.
 * @property drawSessionSeconds Exclusive draw session duration in seconds.
 * @property status Current lifecycle state.
 * @property activatedAt Timestamp of the first ACTIVE transition.
 * @property soldOutAt Timestamp when all boxes sold out.
 * @property createdByStaffId FK to the Staff member who created this campaign.
 * @property deletedAt Soft-delete timestamp.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 * @property approvalStatus Approval gate status.
 * @property approvedBy FK to the approving staff member.
 * @property approvedAt Timestamp of the approval decision.
 * @property lowStockNotifiedAt Timestamp when the low-stock notification was dispatched.
 */
public data class KujiCampaign(
    val id: CampaignId,
    val title: String,
    val description: String?,
    val coverImageUrl: String?,
    val pricePerDraw: Int,
    val drawSessionSeconds: Int,
    val status: CampaignStatus,
    val activatedAt: Instant?,
    val soldOutAt: Instant?,
    val createdByStaffId: UUID,
    val deletedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
    val approvalStatus: ApprovalStatus = ApprovalStatus.NOT_REQUIRED,
    val approvedBy: UUID? = null,
    val approvedAt: Instant? = null,
    val lowStockNotifiedAt: Instant? = null,
)
