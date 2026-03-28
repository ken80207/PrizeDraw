package com.prizedraw.contracts.dto.pity

import kotlinx.serialization.Serializable

/** Admin request to create or update a pity rule. */
@Serializable
public data class UpsertPityRuleRequest(
    val threshold: Int,
    val accumulationMode: String,
    val sessionTimeoutSeconds: Int? = null,
    val enabled: Boolean,
    val prizePool: List<PityPrizePoolItemRequest>,
)

/** A single item in the pity prize pool request. */
@Serializable
public data class PityPrizePoolItemRequest(
    val prizeDefinitionId: String,
    val weight: Int,
)

/** Admin response for a pity rule with its prize pool. */
@Serializable
public data class PityRuleDto(
    val id: String,
    val campaignId: String,
    val threshold: Int,
    val accumulationMode: String,
    val sessionTimeoutSeconds: Int? = null,
    val enabled: Boolean,
    val prizePool: List<PityPrizePoolItemDto>,
)

/** A single item in the pity prize pool response. */
@Serializable
public data class PityPrizePoolItemDto(
    val prizeDefinitionId: String,
    val grade: String,
    val prizeName: String,
    val weight: Int,
)

/** Player-facing pity info on campaign detail. */
@Serializable
public data class PityInfoDto(
    val enabled: Boolean,
    val threshold: Int,
    val mode: String,
    val sessionTimeoutSeconds: Int? = null,
)

/** Player-facing pity progress returned with each draw result. */
@Serializable
public data class PityProgressDto(
    val drawCount: Int,
    val threshold: Int,
    val isPityTriggered: Boolean,
    val mode: String,
    val sessionExpiresAt: String? = null,
)
