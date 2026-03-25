package com.prizedraw.shared.validation

import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.round

/**
 * Validates and formats probability values expressed in basis points.
 *
 * The PrizeDraw platform represents probabilities as integer basis points where
 * 1 000 000 bps = 100 %. Prize definitions within a campaign must collectively
 * sum to exactly 1 000 000 bps.
 */
public class ProbabilityValidator {
    /**
     * Returns `true` when the list of prize probability values sums to exactly 1 000 000 bps
     * (representing 100 % probability coverage).
     *
     * An empty list returns `false` because no prizes cannot cover 100 %.
     *
     * @param probabilities Each entry is the probability for one prize definition, in bps.
     */
    public fun validateProbabilitySum(probabilities: List<Int>): Boolean =
        probabilities.isNotEmpty() && probabilities.sum() == FULL_PROBABILITY_BPS

    /**
     * Formats a probability expressed in basis points to a human-readable percentage string.
     *
     * Examples:
     * - 500 bps → "0.0500%"
     * - 50_000 bps → "5.0000%"
     * - 1_000_000 bps → "100.0000%"
     *
     * @param bps Probability in basis points (0–1 000 000).
     * @return Formatted string with 4 decimal places followed by "%".
     */
    public fun formatProbabilityBps(bps: Int): String {
        val percentage = bps.toDouble() / FULL_PROBABILITY_BPS * 100.0
        return "${percentage.toStringWithDecimals(4)}%"
    }

    private companion object {
        const val FULL_PROBABILITY_BPS = 1_000_000
    }
}

/**
 * Formats a [Double] to a string with exactly [decimals] decimal places without
 * relying on [String.format], which is unavailable in Kotlin/JS.
 */
internal fun Double.toStringWithDecimals(decimals: Int): String {
    val factor = 10.0.pow(decimals.toDouble())
    val rounded = round(this * factor).toDouble() / factor
    val intPart = rounded.toLong()
    val fracRaw = abs(round((rounded - intPart.toDouble()) * factor))
    val fracStr = fracRaw.toString().padStart(decimals, '0')
    return "$intPart.$fracStr"
}
