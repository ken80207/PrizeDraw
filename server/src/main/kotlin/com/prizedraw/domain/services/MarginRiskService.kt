package com.prizedraw.domain.services

import java.math.BigDecimal
import java.math.RoundingMode

/**
 * Pure calculation service for campaign margin/risk analysis.
 * No I/O — threshold is passed in by the calling use case.
 */
public class MarginRiskService {

    /**
     * Calculate margin for a Kuji campaign (fixed ticket pool).
     *
     * @param pricePerDraw draw cost in points
     * @param prizes list of prize inputs with ticket count and value
     * @param boxCount number of ticket boxes
     * @param thresholdPct margin threshold percentage from system settings
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
     * @param pricePerDraw draw cost in points
     * @param prizes list of prize inputs with probability (bps) and value
     * @param thresholdPct margin threshold percentage from system settings
     */
    public fun calculateUnlimitedMargin(
        pricePerDraw: Int,
        prizes: List<UnlimitedPrizeInput>,
        thresholdPct: BigDecimal,
    ): MarginResult {
        val expectedPayout = prizes.sumOf { prize ->
            BigDecimal(prize.probabilityBps)
                .multiply(BigDecimal(prize.prizeValue))
                .divide(BigDecimal(PROBABILITY_TOTAL), 4, RoundingMode.HALF_UP)
        }
        val revenue = BigDecimal(pricePerDraw)
        val profit = revenue.subtract(expectedPayout)
        val marginPct = if (revenue > BigDecimal.ZERO) {
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
        val marginPct = if (totalRevenue > 0) {
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
