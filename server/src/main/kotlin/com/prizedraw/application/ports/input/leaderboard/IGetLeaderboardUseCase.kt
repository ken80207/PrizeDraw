package com.prizedraw.application.ports.input.leaderboard

import com.prizedraw.contracts.dto.leaderboard.LeaderboardDto
import com.prizedraw.contracts.dto.leaderboard.LeaderboardPeriod
import com.prizedraw.contracts.dto.leaderboard.LeaderboardType
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for fetching a leaderboard by type and period.
 *
 * Scores are read from pre-aggregated Redis sorted sets for low latency.
 * A DB fallback re-populates the cache on miss.
 */
public interface IGetLeaderboardUseCase {
    /**
     * Returns the leaderboard for the given [type] and [period].
     *
     * @param type The metric to rank by (draw count, prize grade, trade volume, or campaign-specific).
     * @param period The time window to aggregate over.
     * @param campaignId Required when [type] is [LeaderboardType.CAMPAIGN_SPECIFIC]; ignored otherwise.
     * @param limit Maximum number of entries to return (default 100, max 500).
     * @param requestingPlayerId When provided, appends the requesting player's own rank as [LeaderboardDto.selfRank].
     * @return [LeaderboardDto] containing ranked entries and optional self-rank.
     */
    public suspend fun execute(
        type: LeaderboardType,
        period: LeaderboardPeriod,
        campaignId: CampaignId? = null,
        limit: Int = DEFAULT_LIMIT,
        requestingPlayerId: PlayerId? = null,
    ): LeaderboardDto

    public companion object {
        public const val DEFAULT_LIMIT: Int = 100
        public const val MAX_LIMIT: Int = 500
    }
}
