package com.prizedraw.domain.valueobjects

/**
 * A draw probability expressed in basis points of 0.0001%.
 *
 * The integer range `[0, 1_000_000]` maps to `[0.000000%, 100.000000%]`.
 * Using integer basis points avoids floating-point precision issues when
 * summing probabilities across PrizeDefinitions in an Unlimited campaign
 * (the invariant is `SUM(bps) == 1_000_000`).
 *
 * Example: `bps = 50_000` represents a 5.0000% probability.
 *
 * @property bps Probability in integer basis points. Must be in `[0, 1_000_000]`.
 * @throws IllegalArgumentException if [bps] is outside the valid range.
 */
@JvmInline
public value class DrawProbability(
    public val bps: Int,
) {
    init {
        require(bps in 0..TOTAL_BPS) {
            "DrawProbability bps must be in [0, $TOTAL_BPS], was: $bps"
        }
    }

    /**
     * Converts this probability to a percentage value.
     *
     * Example: `DrawProbability(50_000).toPercent()` returns `5.0`.
     */
    public fun toPercent(): Double = bps.toDouble() / BPS_PER_PERCENT

    /** Returns true if this represents a zero probability. */
    public fun isZero(): Boolean = bps == 0

    /** Returns true if this represents a 100% probability. */
    public fun isCertain(): Boolean = bps == TOTAL_BPS

    override fun toString(): String = "${toPercent()}%"

    public companion object {
        /** The total probability in basis points that must be allocated across all definitions. */
        public const val TOTAL_BPS: Int = 1_000_000

        /** Number of basis points equivalent to one percentage point (1% = 10_000 bps). */
        public const val BPS_PER_PERCENT: Double = 10_000.0

        /** Zero probability: this prize can never be drawn. */
        public val ZERO: DrawProbability = DrawProbability(0)

        /** Certainty: this prize is always drawn. */
        public val CERTAIN: DrawProbability = DrawProbability(TOTAL_BPS)
    }
}
