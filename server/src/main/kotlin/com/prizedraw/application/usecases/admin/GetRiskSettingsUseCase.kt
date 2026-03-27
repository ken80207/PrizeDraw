package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.output.ISystemSettingsRepository
import com.prizedraw.contracts.dto.admin.RiskSettingsResponse
import com.prizedraw.contracts.dto.admin.RiskSettingsUpdateRequest
import com.prizedraw.domain.valueobjects.StaffId
import java.math.BigDecimal

/**
 * Read and update risk control settings (margin threshold, approval toggle).
 */
public class GetRiskSettingsUseCase(
    private val settingsRepository: ISystemSettingsRepository,
) {
    /** Get current risk settings. */
    public suspend fun get(): RiskSettingsResponse {
        return RiskSettingsResponse(
            marginThresholdPct = settingsRepository.getMarginThresholdPct().toDouble(),
            requireApprovalBelowThreshold = settingsRepository.getRequireApprovalBelowThreshold(),
        )
    }

    /** Update risk settings. Only non-null fields are updated. */
    public suspend fun update(request: RiskSettingsUpdateRequest, staffId: StaffId) {
        request.marginThresholdPct?.let {
            require(it in 0.0..100.0) { "Threshold must be between 0 and 100" }
            settingsRepository.updateMarginThresholdPct(BigDecimal(it.toString()), staffId.value)
        }
        request.requireApprovalBelowThreshold?.let {
            settingsRepository.updateRequireApprovalBelowThreshold(it, staffId.value)
        }
    }
}
