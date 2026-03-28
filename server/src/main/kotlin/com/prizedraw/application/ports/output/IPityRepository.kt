package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.PityPrizePoolEntry
import com.prizedraw.domain.entities.PityRule
import com.prizedraw.domain.entities.PityTracker
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/** Output port for pity system persistence operations. */
public interface IPityRepository {
    /** Finds the pity rule for a campaign, or null if none configured. */
    public suspend fun findRuleByCampaignId(campaignId: CampaignId): PityRule?

    /** Finds a pity rule by its ID. */
    public suspend fun findRuleById(ruleId: UUID): PityRule?

    /** Saves (insert or update) a pity rule. */
    public suspend fun saveRule(rule: PityRule): PityRule

    /** Deletes a pity rule and cascades to pool + trackers. */
    public suspend fun deleteRule(ruleId: UUID)

    /** Finds all prize pool entries for a pity rule. */
    public suspend fun findPoolByRuleId(ruleId: UUID): List<PityPrizePoolEntry>

    /** Replaces the entire prize pool for a pity rule. */
    public suspend fun replacePool(
        ruleId: UUID,
        entries: List<PityPrizePoolEntry>,
    )

    /** Finds the player's tracker for a pity rule, or null if none exists. */
    public suspend fun findTracker(
        ruleId: UUID,
        playerId: PlayerId,
    ): PityTracker?

    /** Saves (insert or update) a pity tracker with optimistic locking. Returns false on version conflict. */
    public suspend fun saveTracker(tracker: PityTracker): Boolean
}
