package com.prizedraw.domain.entities

import kotlinx.datetime.Instant
import kotlinx.serialization.json.JsonObject
import java.util.UUID

/**
 * Configuration for a player tier, loaded from the `tier_configs` table.
 *
 * @property tier Unique tier identifier, e.g. `BRONZE`, `GOLD`.
 * @property displayName Localised display label shown in the UI.
 * @property minXp Minimum cumulative XP required to hold this tier.
 * @property icon Emoji or short string used as the tier badge.
 * @property color Hex colour used for tier-specific UI theming.
 * @property benefits JSON bag of tier benefits (fee discounts, flags, bonus points, etc.).
 * @property sortOrder Ascending sort position; lower = earlier tier.
 */
public data class TierConfig(
    val tier: String,
    val displayName: String,
    val minXp: Int,
    val icon: String,
    val color: String,
    val benefits: JsonObject,
    val sortOrder: Int,
)

/**
 * A single credit of XP awarded to a player for a specific action.
 *
 * @property id Surrogate primary key.
 * @property playerId The player who earned the XP.
 * @property amount XP amount credited (always positive).
 * @property sourceType The action category that triggered the award.
 * @property sourceId Optional reference to the draw ticket, trade order, or other entity.
 * @property description Human-readable explanation surfaced in the XP history feed.
 * @property createdAt When the XP was awarded.
 */
public data class XpTransaction(
    val id: UUID,
    val playerId: UUID,
    val amount: Int,
    val sourceType: XpSourceType,
    val sourceId: UUID?,
    val description: String?,
    val createdAt: Instant,
)

/**
 * Enumeration of all recognised XP source categories.
 *
 * New categories must be added here **and** allowed in the `source_type` check constraint
 * (or left unconstrained at the DB level as is currently the case).
 */
public enum class XpSourceType {
    KUJI_DRAW,
    UNLIMITED_DRAW,
    TRADE_PURCHASE,
    DAILY_LOGIN,
    ACHIEVEMENT,
}
