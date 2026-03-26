package com.prizedraw.domain.entities

import kotlin.math.sqrt

/**
 * Stateless XP and levelling formula definitions.
 *
 * All calculations are pure functions with no I/O, making them safe to call from any
 * layer. The level curve is quadratic: each successive level requires (level-1)^2 * 100
 * cumulative XP, so early levels are cheap and later ones escalate steeply.
 *
 * Example curve:
 * - Level 1:    0 XP
 * - Level 2:  100 XP
 * - Level 5:  1,600 XP
 * - Level 10: 8,100 XP
 * - Level 20: 36,100 XP
 */
public object XpRules {
    /** Divisor used by [levelFromXp] and [xpForLevel] for the quadratic level curve. */
    private const val XP_PER_LEVEL_DIVISOR = 100

    /** XP earned per draw point spent. 1:1 ratio — spend 100 points = earn 100 XP. */
    public const val XP_PER_DRAW_POINT: Int = 1

    /** Bonus XP awarded on the first draw of the calendar day. */
    public const val DAILY_FIRST_DRAW_BONUS: Int = 50

    /** XP rate for trade purchases (buyer side): 50% of trade price. */
    public const val TRADE_PURCHASE_XP_RATE: Double = 0.5

    /**
     * Derives the player's level from their cumulative [xp].
     *
     * Formula: `1 + floor(sqrt(xp / 100))`
     *
     * @param xp Current cumulative XP (non-negative).
     * @return Level number, minimum 1.
     */
    public fun levelFromXp(xp: Int): Int = 1 + sqrt(xp.toDouble() / XP_PER_LEVEL_DIVISOR).toInt()

    /**
     * Returns the total cumulative XP required to reach [level].
     *
     * Formula: `(level - 1)^2 * 100`
     *
     * @param level Target level (minimum 1).
     * @return XP threshold for the given level.
     */
    public fun xpForLevel(level: Int): Int = (level - 1) * (level - 1) * XP_PER_LEVEL_DIVISOR

    /**
     * Returns how much more XP the player needs to reach the next level.
     *
     * @param currentXp The player's current cumulative XP.
     * @return XP gap to the next level boundary (always >= 0).
     */
    public fun xpToNextLevel(currentXp: Int): Int {
        val currentLevel = levelFromXp(currentXp)
        return xpForLevel(currentLevel + 1) - currentXp
    }

    /**
     * Returns the fractional progress through the current level band as a value in [0.0, 1.0].
     *
     * @param currentXp The player's current cumulative XP.
     * @return Progress ratio; 0.0 means just entered the level, 1.0 means just completed it.
     */
    public fun xpProgress(currentXp: Int): Float {
        val currentLevel = levelFromXp(currentXp)
        val levelStart = xpForLevel(currentLevel)
        val levelEnd = xpForLevel(currentLevel + 1)
        val bandWidth = levelEnd - levelStart
        return if (bandWidth <= 0) {
            1f
        } else {
            ((currentXp - levelStart).toFloat() / bandWidth).coerceIn(0f, 1f)
        }
    }

}
