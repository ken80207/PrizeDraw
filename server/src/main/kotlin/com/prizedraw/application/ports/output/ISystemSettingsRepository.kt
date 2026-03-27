package com.prizedraw.application.ports.output

import java.math.BigDecimal
import java.util.UUID

/** Port for reading and updating system-level configuration values. */
public interface ISystemSettingsRepository {
    /** Get the margin threshold percentage from system settings. */
    public suspend fun getMarginThresholdPct(): BigDecimal

    /** Get whether approval is required below threshold. */
    public suspend fun getRequireApprovalBelowThreshold(): Boolean

    /** Update the margin threshold percentage. */
    public suspend fun updateMarginThresholdPct(value: BigDecimal, staffId: UUID)

    /** Update the require-approval-below-threshold flag. */
    public suspend fun updateRequireApprovalBelowThreshold(value: Boolean, staffId: UUID)
}
