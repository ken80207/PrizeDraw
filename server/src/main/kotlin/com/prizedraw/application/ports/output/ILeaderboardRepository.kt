package com.prizedraw.application.ports.output

import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Instant

/**
 * A single entry in a leaderboard ranking.
 *
 * @property rank 1-based rank position.
 * @property playerId The ranked player's identifier.
 * @property nickname The ranked player's display name.
 * @property score The score or count metric used for ranking (e.g. number of draws).
 */
public data class LeaderboardEntry(
    val rank: Int,
    val playerId: PlayerId,
    val nickname: String,
    val score: Long,
)

/**
 * Output port for reading leaderboard data.
 *
 * Leaderboards are read-heavy and may be backed by Redis sorted sets or materialised views.
 * Write paths (score increments) go through the domain event / outbox pattern rather than
 * direct writes via this port.
 */
public interface ILeaderboardRepository {
    /**
     * Returns the top-N players by total draw count across all campaigns within the given window.
     *
     * @param from Start of the time window (inclusive).
     * @param until End of the time window (exclusive).
     * @param limit Maximum number of entries to return.
     * @return Ranked list of leaderboard entries.
     */
    public suspend fun findGlobalTopPlayers(
        from: Instant,
        until: Instant,
        limit: Int,
    ): List<LeaderboardEntry>

    /**
     * Returns the top-N players by draw count for a specific campaign within the given window.
     *
     * @param campaignId The campaign to scope the leaderboard to.
     * @param from Start of the time window (inclusive).
     * @param until End of the time window (exclusive).
     * @param limit Maximum number of entries to return.
     * @return Ranked list of leaderboard entries for the campaign.
     */
    public suspend fun findCampaignTopPlayers(
        campaignId: CampaignId,
        from: Instant,
        until: Instant,
        limit: Int,
    ): List<LeaderboardEntry>

    /**
     * Returns the rank of a specific player in the global leaderboard for the given window.
     *
     * @param playerId The player to look up.
     * @param from Start of the time window (inclusive).
     * @param until End of the time window (exclusive).
     * @return The player's rank, or null if the player has no activity in the window.
     */
    public suspend fun findPlayerRank(
        playerId: PlayerId,
        from: Instant,
        until: Instant,
    ): Int?
}
