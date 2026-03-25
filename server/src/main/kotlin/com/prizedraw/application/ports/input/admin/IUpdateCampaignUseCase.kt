package com.prizedraw.application.ports.input.admin

import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.StaffId

/**
 * Input port for editing non-locked campaign fields.
 *
 * For ACTIVE kuji campaigns only [title], [description], and [coverImageUrl] may be changed
 * (ticket grid is locked). For unlimited campaigns, probability updates require
 * [confirmProbabilityUpdate] = true.
 */
public interface IUpdateCampaignUseCase {
    /**
     * Updates editable fields on the given campaign.
     *
     * @param staffId The staff member performing the update.
     * @param campaignId The campaign to update.
     * @param campaignType Whether this is a KUJI or UNLIMITED campaign.
     * @param title Optional new title.
     * @param description Optional new description (null = no change).
     * @param coverImageUrl Optional new cover image URL (null = no change).
     * @param confirmProbabilityUpdate Must be true to update probabilities on an active unlimited campaign.
     */
    public suspend fun execute(
        staffId: StaffId,
        campaignId: CampaignId,
        campaignType: CampaignType,
        title: String?,
        description: String?,
        coverImageUrl: String?,
        confirmProbabilityUpdate: Boolean,
    )
}
