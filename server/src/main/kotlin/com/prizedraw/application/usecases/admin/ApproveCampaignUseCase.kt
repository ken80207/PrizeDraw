package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.ISystemSettingsRepository
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.StaffId

/**
 * Approves or rejects a campaign pending manager approval.
 * Pre-built for future use — currently gated by `require_approval_below_threshold` setting.
 */
public class ApproveCampaignUseCase(
    private val campaignRepository: ICampaignRepository,
    private val settingsRepository: ISystemSettingsRepository,
) {
    /** Approve a campaign pending review. */
    public suspend fun approve(
        campaignId: CampaignId,
        staffId: StaffId,
    ) {
        requireFeatureEnabled()
        TODO("Approval flow not yet active")
    }

    /** Reject a campaign pending review. */
    public suspend fun reject(
        campaignId: CampaignId,
        staffId: StaffId,
        reason: String? = null,
    ) {
        requireFeatureEnabled()
        TODO("Approval flow not yet active")
    }

    private suspend fun requireFeatureEnabled() {
        val enabled = settingsRepository.getRequireApprovalBelowThreshold()
        check(enabled) { "Approval workflow is not enabled. Enable via risk settings." }
    }
}
