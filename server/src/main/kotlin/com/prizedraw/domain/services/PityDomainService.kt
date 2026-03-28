package com.prizedraw.domain.services

import com.prizedraw.domain.entities.AccumulationMode
import com.prizedraw.domain.entities.PityPrizePoolEntry
import com.prizedraw.domain.entities.PityRule
import com.prizedraw.domain.entities.PityTracker
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import kotlinx.datetime.Instant
import java.security.SecureRandom

/** Result of evaluating the pity system for a single draw. */
public sealed class PityResult {
    /** The draw count after this evaluation. */
    public abstract val newDrawCount: Int

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
 * Pure domain service for pity (guaranteed-drop) mechanics.
 *
 * Evaluates whether a draw should trigger a pity guarantee based on
 * the rule configuration, player tracker state, and prize pool.
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
