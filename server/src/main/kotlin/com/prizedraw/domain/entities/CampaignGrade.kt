package com.prizedraw.domain.entities

import com.prizedraw.domain.valueobjects.CampaignGradeId
import com.prizedraw.domain.valueobjects.CampaignId
import kotlinx.datetime.Instant

/**
 * A grade tier scoped to a specific campaign.
 *
 * Created by copying from a [GradeTemplate] or manually by staff.
 * Once created, campaign grades are independent — editing or deleting the
 * source template has no effect.
 *
 * Exactly one of [kujiCampaignId] and [unlimitedCampaignId] must be non-null.
 *
 * @property id Surrogate primary key.
 * @property kujiCampaignId FK to a kuji campaign. Non-null only for kuji campaign grades.
 * @property unlimitedCampaignId FK to an unlimited campaign. Non-null only for unlimited grades.
 * @property name Grade display name, e.g. "超神".
 * @property displayOrder Rendering order (lower = rarer).
 * @property colorCode Primary text color as hex.
 * @property bgColorCode Background color as hex.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class CampaignGrade(
    val id: CampaignGradeId,
    val kujiCampaignId: CampaignId?,
    val unlimitedCampaignId: CampaignId?,
    val name: String,
    val displayOrder: Int,
    val colorCode: String,
    val bgColorCode: String,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    init {
        require((kujiCampaignId == null) != (unlimitedCampaignId == null)) {
            "Exactly one of kujiCampaignId or unlimitedCampaignId must be non-null"
        }
    }
}
