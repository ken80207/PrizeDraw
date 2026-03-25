package com.prizedraw.application.ports.input.admin

import com.prizedraw.domain.valueobjects.StaffId

/**
 * Input port for updating the global trade fee rate.
 *
 * The rate is stored as a feature flag keyed `platform_config.trade_fee_rate_bps`.
 * Records an [com.prizedraw.domain.entities.AuditLog] entry with before/after values.
 * Validates [tradeFeeRateBps] is in the range [0, 10000].
 */
public interface IUpdateTradeFeeRateUseCase {
    /**
     * Updates the global trade fee rate.
     *
     * @param staffId The staff member performing the update.
     * @param tradeFeeRateBps New trade fee rate in basis points. Valid range: 0..10000.
     * @return The newly applied rate in basis points.
     */
    public suspend fun execute(
        staffId: StaffId,
        tradeFeeRateBps: Int,
    ): Int
}
