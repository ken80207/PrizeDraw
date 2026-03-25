package com.prizedraw.domain.services

import com.prizedraw.domain.entities.PrizeDefinition
import java.security.SecureRandom

/** Total probability basis points representing 100% across all prize definitions. */
private const val TOTAL_BPS = 1_000_000

/**
 * Domain service that performs probability-based prize selection for unlimited draws.
 *
 * Prize selection is based on a Cumulative Distribution Function (CDF) built from the
 * [PrizeDefinition.probabilityBps] values. A cryptographically secure random integer in
 * `[0, 1_000_000)` is compared against the CDF via binary search to identify the winning
 * prize tier in O(log n) time.
 *
 * All methods are pure and perform no I/O. Callers must validate campaign state and load
 * definitions before invoking these methods.
 */
public class UnlimitedDrawDomainService {
    private val secureRandom = SecureRandom()

    /**
     * Validates that the probabilities of all [definitions] sum to exactly [TOTAL_BPS].
     *
     * Called during campaign activation to ensure the probability table is exhaustive and
     * consistent. Returns false (rather than throwing) so the caller can surface a
     * domain-friendly error message.
     *
     * @param definitions Prize definitions belonging to a single [UnlimitedCampaign].
     * @return True if the sum equals 1,000,000; false otherwise.
     */
    public fun validateProbabilitySum(definitions: List<PrizeDefinition>): Boolean {
        val sum = definitions.sumOf { it.probabilityBps ?: 0 }
        return sum == TOTAL_BPS
    }

    /**
     * Selects one prize definition by sampling the CDF derived from [probabilityBps] values.
     *
     * Processing steps:
     * 1. Verify [validateProbabilitySum] holds (throws [DrawValidationException] if not).
     * 2. Build a CDF array where `cdf[i]` is the cumulative sum of probabilities up to index `i`.
     * 3. Draw a uniform random integer in `[0, 1_000_000)` using [SecureRandom].
     * 4. Binary-search the CDF for the leftmost index whose cumulative threshold exceeds the roll.
     *
     * @param definitions Non-empty list of prize definitions for the campaign.
     * @return The selected [PrizeDefinition].
     * @throws DrawValidationException if the probability sum is not exactly 1,000,000 or
     *   [definitions] is empty.
     */
    public fun spin(definitions: List<PrizeDefinition>): PrizeDefinition {
        require(definitions.isNotEmpty()) { "Prize definitions list must not be empty" }
        if (!validateProbabilitySum(definitions)) {
            throw DrawValidationException(
                "Probability sum is ${definitions.sumOf { it.probabilityBps ?: 0 }} bps; " +
                    "must equal $TOTAL_BPS",
            )
        }
        val cdf = buildCdf(definitions)
        val roll = secureRandom.nextInt(TOTAL_BPS)
        val index = binarySearchCdf(cdf, roll)
        return definitions[index]
    }

    /**
     * Builds a CDF array from the prize definitions.
     *
     * @param definitions Prize definitions with non-null [PrizeDefinition.probabilityBps].
     * @return An [IntArray] of size `definitions.size` where each element is the inclusive
     *   cumulative probability threshold for the corresponding definition.
     */
    private fun buildCdf(definitions: List<PrizeDefinition>): IntArray {
        val cdf = IntArray(definitions.size)
        var cumulative = 0
        definitions.forEachIndexed { i, def ->
            cumulative += def.probabilityBps ?: 0
            cdf[i] = cumulative
        }
        return cdf
    }

    /**
     * Finds the first CDF bucket that the [roll] falls into.
     *
     * Uses binary search: the winning index is the smallest `i` such that `cdf[i] > roll`.
     * This correctly maps the half-open interval `[cdf[i-1], cdf[i])` to `definitions[i]`.
     *
     * @param cdf Cumulative distribution array (monotonically non-decreasing, last element = 1_000_000).
     * @param roll Random integer in `[0, 1_000_000)`.
     * @return The index into the prize definitions array.
     */
    private fun binarySearchCdf(
        cdf: IntArray,
        roll: Int,
    ): Int {
        var lo = 0
        var hi = cdf.size - 1
        while (lo < hi) {
            val mid = (lo + hi) ushr 1
            if (cdf[mid] <= roll) {
                lo = mid + 1
            } else {
                hi = mid
            }
        }
        return lo
    }
}
