package com.prizedraw.shared.validation

/**
 * Validates draw-point affordability and cost calculations using the platform's
 * basis-points (bps) discount representation (1 bps = 0.01%).
 *
 * All amounts are expressed as integers of the smallest currency unit (points).
 * Discount rates are expressed in basis points where 10 000 bps = 100 %.
 */
public class DrawPointsValidator {
    /**
     * Returns `true` when the player's [balance] covers the cost of [quantity] draws
     * at [pricePerDraw] points each, with no discount applied.
     *
     * @param balance Current draw-point balance of the player.
     * @param pricePerDraw Cost of a single draw in draw points.
     * @param quantity Number of draws the player wants to perform.
     */
    public fun canAffordDraw(
        balance: Int,
        pricePerDraw: Int,
        quantity: Int,
    ): Boolean = balance >= pricePerDraw * quantity

    /**
     * Calculates the total cost for [quantity] draws at [pricePerDraw], optionally
     * applying a discount expressed in basis points.
     *
     * Rounding is ceiling so the platform never loses fractional points.
     *
     * @param pricePerDraw Cost of a single draw in draw points.
     * @param quantity Number of draws.
     * @param discountBps Optional discount in basis points (e.g. 500 = 5 %). Null or 0 means no discount.
     * @return Total cost after applying any discount, rounded up to the nearest integer.
     */
    public fun calculateTotalCost(
        pricePerDraw: Int,
        quantity: Int,
        discountBps: Int?,
    ): Int {
        val gross = pricePerDraw * quantity
        val effectiveDiscount = discountBps ?: 0
        return if (effectiveDiscount <= 0) {
            gross
        } else {
            // Ceiling division: (gross * (10_000 - discount) + 9_999) / 10_000
            (gross.toLong() * (10_000 - effectiveDiscount) + 9_999L).toInt() / 10_000
        }
    }

    /**
     * Applies a basis-point discount to a single [originalPrice].
     *
     * @param originalPrice Original per-unit price in draw points.
     * @param discountBps Discount rate in basis points (1–9 999). Values outside [1, 9999] are clamped.
     * @return Discounted price, rounded up to the nearest integer point.
     */
    public fun calculateDiscountedPrice(
        originalPrice: Int,
        discountBps: Int,
    ): Int {
        val clampedBps = discountBps.coerceIn(1, 9_999)
        return (originalPrice.toLong() * (10_000 - clampedBps) + 9_999L).toInt() / 10_000
    }
}
