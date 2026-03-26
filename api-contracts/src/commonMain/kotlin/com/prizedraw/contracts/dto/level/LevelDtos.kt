package com.prizedraw.contracts.dto.level

import kotlinx.serialization.Serializable

/**
 * Player level and tier snapshot returned by `GET /api/v1/players/me/level`.
 *
 * @property xp Cumulative XP earned by the player.
 * @property level Current level number (minimum 1).
 * @property tier Tier key, e.g. `BRONZE`, `GOLD`.
 * @property tierDisplayName Localised tier label, e.g. `金牌會員`.
 * @property tierIcon Emoji or short icon string for the tier badge.
 * @property tierColor Hex colour string for tier-specific UI theming.
 * @property xpToNextLevel XP needed to reach the next level boundary.
 * @property xpProgress Fractional progress through the current level band [0.0, 1.0].
 * @property benefits Key-value pairs of tier benefits (e.g. `trade_fee_discount_bps: "1000"`).
 */
@Serializable
public data class PlayerLevelDto(
    val xp: Int,
    val level: Int,
    val tier: String,
    val tierDisplayName: String,
    val tierIcon: String,
    val tierColor: String,
    val xpToNextLevel: Int,
    val xpProgress: Float,
    val benefits: Map<String, String>,
)

/**
 * Reference data for a single tier, returned by `GET /api/v1/tiers`.
 *
 * @property tier Tier key.
 * @property displayName Localised tier label.
 * @property minXp Minimum cumulative XP required to reach this tier.
 * @property icon Tier badge icon.
 * @property color Hex colour string.
 * @property benefits Key-value pairs of tier benefits.
 */
@Serializable
public data class TierConfigDto(
    val tier: String,
    val displayName: String,
    val minXp: Int,
    val icon: String,
    val color: String,
    val benefits: Map<String, String>,
)

/**
 * A single XP credit record returned in `GET /api/v1/players/me/xp-history`.
 *
 * @property id XP transaction UUID as a string.
 * @property amount XP amount credited.
 * @property sourceType Source category name (e.g. `KUJI_DRAW`).
 * @property description Human-readable description. Null if none was recorded.
 * @property createdAt ISO-8601 timestamp string.
 */
@Serializable
public data class XpTransactionDto(
    val id: String,
    val amount: Int,
    val sourceType: String,
    val description: String?,
    val createdAt: String,
)

/**
 * A single entry in the XP leaderboard, returned by `GET /api/v1/leaderboard/xp`.
 *
 * @property rank 1-based rank position.
 * @property playerId Player UUID as a string.
 * @property nickname Player display name.
 * @property avatarUrl Optional profile image URL.
 * @property xp Cumulative XP.
 * @property level Current level.
 * @property tier Current tier key.
 */
@Serializable
public data class XpLeaderboardEntryDto(
    val rank: Int,
    val playerId: String,
    val nickname: String,
    val avatarUrl: String?,
    val xp: Int,
    val level: Int,
    val tier: String,
)

/**
 * Push-notification payload emitted when a player levels up or changes tier.
 *
 * Delivered via the outbox worker; consumed by the mobile client's notification handler.
 *
 * @property newLevel Level reached after the XP award.
 * @property newTier Non-null when the tier also changed in the same XP award.
 * @property xpEarned XP credited in the triggering action.
 */
@Serializable
public data class LevelUpEventDto(
    val newLevel: Int,
    val newTier: String?,
    val xpEarned: Int,
)
