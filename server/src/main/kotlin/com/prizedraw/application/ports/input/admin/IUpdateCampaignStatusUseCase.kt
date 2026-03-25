package com.prizedraw.application.ports.input.admin

import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.StaffId

/**
 * Input port for transitioning a campaign through its lifecycle states.
 *
 * Allowed transitions:
 * - DRAFT → ACTIVE  (publishes campaign; locks kuji ticket grid)
 * - ACTIVE → SUSPENDED
 * - SUSPENDED → ACTIVE
 *
 * All other transitions are rejected with [InvalidCampaignTransitionException].
 */
public interface IUpdateCampaignStatusUseCase {
    /**
     * Applies a status transition to the given campaign.
     *
     * @param staffId The staff member requesting the transition.
     * @param campaignId The campaign to transition.
     * @param campaignType Whether this is a KUJI or UNLIMITED campaign.
     * @param newStatus The target status.
     */
    public suspend fun execute(
        staffId: StaffId,
        campaignId: CampaignId,
        campaignType: CampaignType,
        newStatus: CampaignStatus,
    )
}
