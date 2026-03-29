@file:Suppress("MagicNumber")

package com.prizedraw.draw.domain.services

import com.prizedraw.draw.domain.entities.AccumulationMode
import com.prizedraw.draw.domain.entities.DrawTicket
import com.prizedraw.draw.domain.entities.DrawTicketStatus
import com.prizedraw.draw.domain.entities.PityPrizePoolEntry
import com.prizedraw.draw.domain.entities.PityRule
import com.prizedraw.draw.domain.entities.PityTracker
import com.prizedraw.draw.domain.entities.PrizeDefinition
import com.prizedraw.draw.domain.entities.Queue
import com.prizedraw.draw.domain.entities.TicketBox
import com.prizedraw.draw.domain.valueobjects.PlayerId
import com.prizedraw.draw.domain.valueobjects.PrizeDefinitionId
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import java.math.BigDecimal
import java.math.RoundingMode
import java.security.SecureRandom

// ---------------------------------------------------------------------------
// Shared exception
// ---------------------------------------------------------------------------

/**
 * Thrown when a draw validation rule is violated (draw-service copy).
 */
public class DrawValidationException(
    message: String,
) : IllegalStateException(message)

// ---------------------------------------------------------------------------
// KujiDrawDomainService
// ---------------------------------------------------------------------------

/**
 * Domain service encapsulating kuji draw validation and ticket selection logic
 * (draw-service copy).
 *
 * All methods are pure and throw [DrawValidationException] on rule violations.
 * No I/O is performed.
 */
public class KujiDrawDomainService {
    private val secureRandom = SecureRandom()

    /**
     * Validates that a player is eligible to draw the specified ticket.
     *
     * Rules enforced:
     * 1. Ticket must not already be [DrawTicketStatus.DRAWN].
     * 2. Session must not be expired.
     * 3. Player must be the active session holder.
     *
     * @param ticket The ticket the player wants to draw.
     * @param queue The queue associated with the ticket's box.
     * @param playerId The player requesting the draw.
     * @throws DrawValidationException if any rule is violated.
     */
    public fun validateTicketSelection(
        ticket: DrawTicket,
        queue: Queue,
        playerId: PlayerId,
    ) {
        if (ticket.status == DrawTicketStatus.DRAWN) {
            throw DrawValidationException("Ticket ${ticket.id} has already been drawn")
        }
        val now = Clock.System.now()
        val expiresAt =
            queue.sessionExpiresAt
                ?: throw DrawValidationException("No active session on queue ${queue.id}")
        if (now >= expiresAt) {
            throw DrawValidationException("Draw session expired at $expiresAt")
        }
        if (queue.activePlayerId != playerId) {
            throw DrawValidationException(
                "Player ${playerId.value} is not the active session holder for queue ${queue.id}",
            )
        }
    }

    /**
     * Validates that the box has enough remaining tickets for a multi-draw.
     *
     * @param box The ticket box to draw from.
     * @param quantity The number of tickets requested.
     * @throws DrawValidationException if [TicketBox.remainingTickets] < [quantity].
     */
    public fun validateMultiDraw(
        box: TicketBox,
        quantity: Int,
    ) {
        require(quantity > 0) { "Quantity must be positive, was $quantity" }
        if (box.remainingTickets < quantity) {
            throw DrawValidationException(
                "Box ${box.id} has only ${box.remainingTickets} remaining tickets; requested $quantity",
            )
        }
    }

    /**
     * Selects [quantity] tickets at random from [availableTickets] using [SecureRandom].
     *
     * Uses Fisher-Yates partial shuffle so every combination is equally likely.
     *
     * @param availableTickets All tickets eligible to be drawn (status = AVAILABLE).
     * @param quantity Number of tickets to select.
     * @return A list of exactly [quantity] randomly selected tickets.
     */
    public fun selectRandomTickets(
        availableTickets: List<DrawTicket>,
        quantity: Int,
    ): List<DrawTicket> {
        require(availableTickets.size >= quantity) {
            "Not enough available tickets: have ${availableTickets.size}, need $quantity"
        }
        val mutable = availableTickets.toMutableList()
        repeat(quantity) { i ->
            val swapIdx = i + secureRandom.nextInt(mutable.size - i)
            val tmp = mutable[i]
            mutable[i] = mutable[swapIdx]
            mutable[swapIdx] = tmp
        }
        return mutable.subList(0, quantity).toList()
    }
}

// ---------------------------------------------------------------------------
// UnlimitedDrawDomainService
// ---------------------------------------------------------------------------

/** Total probability basis points representing 100% across all prize definitions. */
private const val TOTAL_BPS = 1_000_000

/**
 * Domain service that performs probability-based prize selection for unlimited draws
 * (draw-service copy).
 *
 * Uses CDF built from [PrizeDefinition.probabilityBps] with binary search O(log n) selection.
 * All methods are pure and perform no I/O.
 */
public class UnlimitedDrawDomainService {
    private val secureRandom = SecureRandom()

    /**
     * Validates that the probabilities of all [definitions] sum to exactly 1,000,000 bps.
     *
     * @param definitions Prize definitions belonging to a single unlimited campaign.
     * @return True if the sum equals 1,000,000; false otherwise.
     */
    public fun validateProbabilitySum(definitions: List<PrizeDefinition>): Boolean {
        val sum = definitions.sumOf { it.probabilityBps ?: 0 }
        return sum == TOTAL_BPS
    }

    /**
     * Selects one prize definition by sampling the CDF derived from [probabilityBps] values.
     *
     * @param definitions Non-empty list of prize definitions for the campaign.
     * @return The selected [PrizeDefinition].
     * @throws DrawValidationException if the probability sum is not exactly 1,000,000.
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

    private fun buildCdf(definitions: List<PrizeDefinition>): IntArray {
        val cdf = IntArray(definitions.size)
        var cumulative = 0
        definitions.forEachIndexed { i, def ->
            cumulative += def.probabilityBps ?: 0
            cdf[i] = cumulative
        }
        return cdf
    }

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

// ---------------------------------------------------------------------------
// PityDomainService
// ---------------------------------------------------------------------------

/** Result of evaluating the pity system for a single draw. */
public sealed class PityResult {
    /** The draw count after this evaluation. */
    public abstract val newDrawCount: Int

    /** The pity threshold for the rule. */
    public abstract val threshold: Int

    /** Pity did not trigger; continue with normal draw. */
    public data class NotTriggered(
        override val newDrawCount: Int,
        override val threshold: Int,
    ) : PityResult()

    /** Pity triggered; use the selected prize definition instead of the normal pool. */
    public data class Triggered(
        val selectedPrizeDefinitionId: PrizeDefinitionId,
        override val newDrawCount: Int,
        override val threshold: Int,
    ) : PityResult()
}

/**
 * Pure domain service for pity (guaranteed-drop) mechanics (draw-service copy).
 *
 * No I/O — all persistence is handled by the caller.
 */
public class PityDomainService {
    private val secureRandom = SecureRandom()

    /**
     * Evaluates pity for a single draw.
     *
     * @param rule The pity rule configuration for the campaign.
     * @param tracker The player's current tracker state, or null if no tracker exists yet.
     * @param pool The pity prize pool entries with weights.
     * @param now Current timestamp for session timeout evaluation.
     * @return [PityResult] indicating whether pity triggered and the new draw count.
     */
    public fun evaluate(
        rule: PityRule,
        tracker: PityTracker?,
        pool: List<PityPrizePoolEntry>,
        now: Instant,
    ): PityResult {
        if (pool.isEmpty()) {
            val currentCount = tracker?.drawCount ?: 0
            return PityResult.NotTriggered(
                newDrawCount = currentCount + 1,
                threshold = rule.threshold,
            )
        }

        val effectiveCount = resolveEffectiveCount(rule, tracker, now)
        val newCount = effectiveCount + 1

        return if (newCount >= rule.threshold) {
            val selected = selectWeightedPrize(pool)
            PityResult.Triggered(
                selectedPrizeDefinitionId = selected,
                newDrawCount = 0,
                threshold = rule.threshold,
            )
        } else {
            PityResult.NotTriggered(
                newDrawCount = newCount,
                threshold = rule.threshold,
            )
        }
    }

    private fun resolveEffectiveCount(
        rule: PityRule,
        tracker: PityTracker?,
        now: Instant,
    ): Int {
        if (tracker == null) {
            return 0
        }
        if (rule.accumulationMode == AccumulationMode.SESSION) {
            val timeout = rule.sessionTimeoutSeconds ?: return tracker.drawCount
            val lastDraw = tracker.lastDrawAt ?: return 0
            val elapsed = (now - lastDraw).inWholeSeconds
            if (elapsed > timeout) {
                return 0
            }
        }
        return tracker.drawCount
    }

    private fun selectWeightedPrize(pool: List<PityPrizePoolEntry>): PrizeDefinitionId {
        val totalWeight = pool.sumOf { it.weight }
        val roll = secureRandom.nextInt(totalWeight)
        var cumulative = 0
        for (entry in pool) {
            cumulative += entry.weight
            if (roll < cumulative) {
                return entry.prizeDefinitionId
            }
        }
        return pool.last().prizeDefinitionId
    }
}

// ---------------------------------------------------------------------------
// MarginRiskService
// ---------------------------------------------------------------------------

/**
 * Pure calculation service for campaign margin/risk analysis (draw-service copy).
 * No I/O — threshold is passed in by the calling use case.
 */
public class MarginRiskService {
    /**
     * Calculate margin for a Kuji campaign (fixed ticket pool).
     *
     * @param pricePerDraw Draw cost in points.
     * @param prizes List of prize inputs with ticket count and value.
     * @param boxCount Number of ticket boxes.
     * @param thresholdPct Margin threshold percentage from system settings.
     */
    public fun calculateKujiMargin(
        pricePerDraw: Int,
        prizes: List<KujiPrizeInput>,
        boxCount: Int,
        thresholdPct: BigDecimal,
    ): MarginResult {
        val ticketsPerBox = prizes.sumOf { it.ticketCount }
        val totalRevenue = ticketsPerBox.toLong() * pricePerDraw * boxCount
        val costPerBox = prizes.sumOf { it.ticketCount.toLong() * it.prizeValue }
        val totalCost = costPerBox * boxCount
        return buildResult(totalRevenue, totalCost, thresholdPct)
    }

    /**
     * Calculate margin for an Unlimited campaign (probability-based).
     *
     * @param pricePerDraw Draw cost in points.
     * @param prizes List of prize inputs with probability (bps) and value.
     * @param thresholdPct Margin threshold percentage from system settings.
     */
    public fun calculateUnlimitedMargin(
        pricePerDraw: Int,
        prizes: List<UnlimitedPrizeInput>,
        thresholdPct: BigDecimal,
    ): MarginResult {
        val expectedPayout =
            prizes.sumOf { prize ->
                BigDecimal(prize.probabilityBps)
                    .multiply(BigDecimal(prize.prizeValue))
                    .divide(BigDecimal(PROBABILITY_TOTAL), 4, RoundingMode.HALF_UP)
            }
        val revenue = BigDecimal(pricePerDraw)
        val profit = revenue.subtract(expectedPayout)
        val marginPct =
            if (revenue > BigDecimal.ZERO) {
                profit.multiply(BigDecimal(100)).divide(revenue, 4, RoundingMode.HALF_UP)
            } else {
                BigDecimal.ZERO
            }
        return MarginResult(
            totalRevenuePerUnit = pricePerDraw,
            totalCostPerUnit = expectedPayout.setScale(0, RoundingMode.HALF_UP).toInt(),
            profitPerUnit = profit.setScale(0, RoundingMode.HALF_UP).toInt(),
            marginPct = marginPct,
            belowThreshold = marginPct < thresholdPct,
            thresholdPct = thresholdPct,
        )
    }

    private fun buildResult(
        totalRevenue: Long,
        totalCost: Long,
        thresholdPct: BigDecimal,
    ): MarginResult {
        val profit = totalRevenue - totalCost
        val marginPct =
            if (totalRevenue > 0) {
                BigDecimal(profit)
                    .multiply(BigDecimal(100))
                    .divide(BigDecimal(totalRevenue), 4, RoundingMode.HALF_UP)
            } else {
                BigDecimal.ZERO
            }
        return MarginResult(
            totalRevenuePerUnit = totalRevenue.toInt(),
            totalCostPerUnit = totalCost.toInt(),
            profitPerUnit = profit.toInt(),
            marginPct = marginPct,
            belowThreshold = marginPct < thresholdPct,
            thresholdPct = thresholdPct,
        )
    }

    private companion object {
        const val PROBABILITY_TOTAL = 1_000_000
    }
}

/** Input for Kuji margin calculation. */
public data class KujiPrizeInput(
    val ticketCount: Int,
    val prizeValue: Int,
)

/** Input for Unlimited margin calculation. */
public data class UnlimitedPrizeInput(
    val probabilityBps: Int,
    val prizeValue: Int,
)

/** Result of a margin calculation. */
public data class MarginResult(
    val totalRevenuePerUnit: Int,
    val totalCostPerUnit: Int,
    val profitPerUnit: Int,
    val marginPct: BigDecimal,
    val belowThreshold: Boolean,
    val thresholdPct: BigDecimal,
)

/**
 * Thrown when a campaign activation is rejected due to low margin (draw-service copy).
 */
public class LowMarginException(
    public val marginResult: MarginResult,
) : RuntimeException(
        "Campaign margin ${marginResult.marginPct}% is below threshold ${marginResult.thresholdPct}%",
    )
