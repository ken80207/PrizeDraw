package com.prizedraw.contracts.endpoints

/** API endpoint constants for the player level/tier and XP leaderboard features. */
public object LevelEndpoints {
    /** Returns all tier configurations. Public — no auth required. */
    public const val TIERS: String = "/api/v1/tiers"

    /** Returns the XP leaderboard (top players by cumulative XP). */
    public const val XP_LEADERBOARD: String = "/api/v1/leaderboard/xp"
}
