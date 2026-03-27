package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.ApprovalStatus
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.valueobjects.CampaignId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A finite, queue-based draw event (一番賞活動).
 *
 * A Kuji campaign owns one or more [TicketBox]es. Once all boxes are sold out
 * the campaign transitions to [CampaignStatus.SOLD_OUT] automatically. The ticket
 * layout is immutable after the campaign reaches [CampaignStatus.ACTIVE] status
 * to guarantee fairness.
 *
 * @property id Surrogate primary key.
 * @property title Campaign display name.
 * @property description Rich-text description shown to players. Null if not set.
 * @property coverImageUrl CDN URL for campaign cover art. Null if not set.
 * @property pricePerDraw Draw points cost per single draw. Must be positive.
 * @property drawSessionSeconds Exclusive draw session duration in seconds. Must be positive.
 * @property status Current lifecycle state.
 * @property activatedAt Timestamp of the first [CampaignStatus.ACTIVE] transition.
 * @property soldOutAt Timestamp when all boxes sold out.
 * @property createdByStaffId FK to the Staff member who created this campaign.
 * @property deletedAt Soft-delete timestamp.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 * @property approvalStatus Approval gate status when margin falls below threshold.
 * @property approvedBy FK to the staff member who approved or rejected this campaign.
 * @property approvedAt Timestamp when the approval decision was recorded.
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
)
