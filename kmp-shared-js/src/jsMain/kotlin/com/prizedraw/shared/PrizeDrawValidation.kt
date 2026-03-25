@file:OptIn(ExperimentalJsExport::class)

package com.prizedraw.shared

import com.prizedraw.shared.validation.CouponValidator
import com.prizedraw.shared.validation.DrawPointsValidator
import com.prizedraw.shared.validation.PhoneValidator
import com.prizedraw.shared.validation.ProbabilityValidator

// Singleton validator instances — allocated once and reused across all JS calls.
private val drawValidator = DrawPointsValidator()
private val probabilityValidator = ProbabilityValidator()
private val phoneValidator = PhoneValidator()
private val couponValidator = CouponValidator()

/**
 * Facade object exported to JavaScript/TypeScript for all PrizeDraw validation logic.
 *
 * Import from the KMP-generated bundle:
 * ```typescript
 * import { com } from './kmp-shared-js';
 * const v = com.prizedraw.shared.PrizeDrawValidation;
 * v.canAffordDraw(500, 100, 3); // true
 * ```
 *
 * All methods are synchronous and pure — no coroutine or async overhead.
 */
@JsExport
public object PrizeDrawValidation {
    // ------------------------------------------------------------------
    // Draw-point affordability
    // ------------------------------------------------------------------

    /**
     * Returns `true` when [balance] is sufficient to perform [quantity] draws
     * at [pricePerDraw] points each.
     */
    public fun canAffordDraw(
        balance: Int,
        pricePerDraw: Int,
        quantity: Int,
    ): Boolean = drawValidator.canAffordDraw(balance, pricePerDraw, quantity)

    /**
     * Calculates the total draw cost after applying an optional basis-point discount.
     *
     * @param pricePerDraw Cost per draw in points.
     * @param quantity Number of draws.
     * @param discountBps Discount in basis points (0 = no discount, 10000 = 100 %).
     * @return Total cost in draw points, ceiling-rounded.
     */
    public fun calculateTotalCost(
        pricePerDraw: Int,
        quantity: Int,
        discountBps: Int,
    ): Int = drawValidator.calculateTotalCost(pricePerDraw, quantity, discountBps.takeIf { it > 0 })

    /**
     * Returns the discounted unit price for a single draw.
     *
     * @param originalPrice Original price in draw points.
     * @param discountBps Discount rate in basis points.
     */
    public fun calculateDiscountedPrice(
        originalPrice: Int,
        discountBps: Int,
    ): Int = drawValidator.calculateDiscountedPrice(originalPrice, discountBps)

    // ------------------------------------------------------------------
    // Probability
    // ------------------------------------------------------------------

    /**
     * Returns `true` when [probabilities] (an [IntArray] for JS interop) sums
     * to exactly 1 000 000 basis points (100 % prize coverage).
     */
    public fun validateProbabilitySum(probabilities: IntArray): Boolean =
        probabilityValidator.validateProbabilitySum(probabilities.toList())

    /**
     * Formats a basis-point probability value as a percentage string with 4 decimal places.
     *
     * Example: `50000` → `"5.0000%"`
     *
     * @param bps Probability in basis points (0–1 000 000).
     */
    public fun formatProbabilityBps(bps: Int): String = probabilityValidator.formatProbabilityBps(bps)

    // ------------------------------------------------------------------
    // Phone
    // ------------------------------------------------------------------

    /**
     * Returns `true` when [phone] is a valid E.164 phone number
     * (e.g. `+886912345678`).
     */
    public fun isValidPhone(phone: String): Boolean = phoneValidator.isValidE164(phone)

    /**
     * Formats a Taiwan E.164 number for display (e.g. `+886912345678` → `0912-345-678`).
     * Non-Taiwan numbers are returned unchanged.
     */
    public fun formatPhoneForDisplay(phone: String): String = phoneValidator.formatForDisplay(phone)

    // ------------------------------------------------------------------
    // Coupon
    // ------------------------------------------------------------------

    /**
     * Returns `true` when the coupon identified by [validUntilEpochMs] has expired.
     * Pass `null` (or `-1` from JS, which is coerced to null) to indicate no expiry.
     *
     * @param validUntilEpochMs Unix epoch milliseconds of expiry, or `-1` for no expiry.
     */
    public fun isCouponExpired(validUntilEpochMs: Double): Boolean =
        couponValidator.isExpired(validUntilEpochMs.toLong().takeIf { it >= 0 })

    /**
     * Calculates the discount amount for [originalPrice] at [discountRateBps].
     *
     * @param originalPrice Price before discount in draw points.
     * @param discountRateBps Discount rate in basis points (e.g. 1500 = 15 %).
     * @return Discount amount in draw points.
     */
    public fun calculateCouponDiscount(
        originalPrice: Int,
        discountRateBps: Int,
    ): Int = couponValidator.calculateDiscount(originalPrice, discountRateBps)
}
