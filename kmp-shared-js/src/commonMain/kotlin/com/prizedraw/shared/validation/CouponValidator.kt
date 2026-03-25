package com.prizedraw.shared.validation

import kotlinx.datetime.Clock

/**
 * Validates coupon eligibility and computes discount amounts.
 *
 * Discount rates are expressed in basis points where 10 000 bps = 100 %.
 * All price values are integers in the smallest unit (draw points).
 *
 * Expiry is determined relative to the current system clock so this class is
 * pure and carries no state — safe to instantiate once and reuse.
 */
public class CouponValidator {
    /**
     * Returns `true` when the coupon has passed its validity window.
     *
     * A `null` [validUntilEpochMs] is treated as "never expires" and returns `false`.
     *
     * @param validUntilEpochMs Unix epoch milliseconds for the coupon's expiry time,
     *   or `null` if the coupon never expires.
     */
    public fun isExpired(validUntilEpochMs: Long?): Boolean {
        validUntilEpochMs ?: return false
        val nowMs = Clock.System.now().toEpochMilliseconds()
        return nowMs > validUntilEpochMs
    }

    /**
     * Calculates the discount amount for an [originalPrice] at the given [discountRateBps].
     *
     * The returned value is the **discount amount** (not the final price). Subtract it from
     * [originalPrice] to get the discounted price. Rounding is floor on the discount amount
     * which is consistent with charging the player the minimum possible.
     *
     * @param originalPrice Price before discount in draw points.
     * @param discountRateBps Discount rate in basis points (e.g. 1500 = 15 %).
     * @return Discount amount in draw points (floor-rounded).
     */
    public fun calculateDiscount(
        originalPrice: Int,
        discountRateBps: Int,
    ): Int {
        if (discountRateBps <= 0) return 0
        return (originalPrice.toLong() * discountRateBps / 10_000L).toInt()
    }
}
