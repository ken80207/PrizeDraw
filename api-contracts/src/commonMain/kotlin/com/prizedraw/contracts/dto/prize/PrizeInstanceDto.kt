package com.prizedraw.contracts.dto.prize

import com.prizedraw.contracts.enums.PrizeState
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

/**
 * Represents a player-owned prize instance, enriched with definition details.
 *
 * @property id Surrogate primary key of the prize instance.
 * @property prizeDefinitionId FK to the prize template.
 * @property grade Prize rarity grade (e.g. `A`, `LAST`).
 * @property name Display name of the prize.
 * @property photoUrl First photo URL from the prize definition, or null.
 * @property state Current lifecycle state.
 * @property acquisitionMethod How the player obtained this prize.
 * @property acquiredAt When the player first received this prize.
 */
@Serializable
public data class PrizeInstanceDto(
    val id: String,
    val prizeDefinitionId: String,
    val grade: String,
    val name: String,
    val photoUrl: String?,
    val state: PrizeState,
    val acquisitionMethod: String,
    val acquiredAt: Instant,
)
