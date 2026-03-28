package com.prizedraw.domain.entities

import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import kotlinx.datetime.Instant
import java.util.UUID

/** Configuration for the guaranteed-drop (pity) mechanic on a campaign. */
public data class PityRule(
    val id: UUID,
    val campaignId: CampaignId,
    val campaignType: String,
    val threshold: Int,
    val accumulationMode: AccumulationMode,
    val sessionTimeoutSeconds: Int?,
    val enabled: Boolean,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/** A single entry in the pity prize pool with its selection weight. */
public data class PityPrizePoolEntry(
    val id: UUID,
    val pityRuleId: UUID,
    val prizeDefinitionId: PrizeDefinitionId,
    val weight: Int,
)

/** Per-player draw counter tracking progress toward the pity guarantee. */
public data class PityTracker(
    val id: UUID,
    val pityRuleId: UUID,
    val playerId: PlayerId,
    val drawCount: Int,
    val lastDrawAt: Instant?,
    val version: Int,
    val createdAt: Instant,
    val updatedAt: Instant,
)
