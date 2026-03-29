package com.prizedraw.draw.application.ports.input

import com.prizedraw.contracts.dto.draw.DrawResultDto
import com.prizedraw.contracts.dto.draw.UnlimitedDrawResultDto
import com.prizedraw.contracts.dto.leaderboard.LeaderboardDto
import com.prizedraw.contracts.dto.leaderboard.LeaderboardPeriod
import com.prizedraw.contracts.dto.leaderboard.LeaderboardType
import com.prizedraw.draw.domain.valueobjects.CampaignId
import com.prizedraw.draw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Input port for executing a kuji draw (draw-service copy).
 */
public interface IDrawKujiUseCase {
    /**
     * Executes a kuji draw on behalf of [playerId].
     *
     * @param playerId The authenticated player performing the draw.
     * @param ticketBoxId The ticket box to draw from.
     * @param ticketIds Explicit ticket IDs for directed draws. Empty for random selection.
     * @param quantity Number of tickets to draw. Ignored when [ticketIds] is non-empty.
     * @param playerCouponId Optional player coupon to apply for a discount.
     * @return A [DrawResultDto] describing each drawn ticket and its prize.
     */
    public suspend fun execute(
        playerId: PlayerId,
        ticketBoxId: UUID,
        ticketIds: List<UUID>,
        quantity: Int,
        playerCouponId: UUID? = null,
    ): DrawResultDto
}

/**
 * Input port for executing a probability-based unlimited draw (draw-service copy).
 */
public interface IDrawUnlimitedUseCase {
    /**
     * Executes a single unlimited draw on behalf of [playerId].
     *
     * @param playerId The authenticated player performing the draw.
     * @param campaignId The unlimited campaign to draw from.
     * @param playerCouponId Optional coupon to apply for a discount.
     * @return An [UnlimitedDrawResultDto] describing the won prize.
     */
    public suspend fun execute(
        playerId: PlayerId,
        campaignId: UUID,
        playerCouponId: UUID?,
    ): UnlimitedDrawResultDto
}

/**
 * Input port for fetching a leaderboard by type and period (draw-service copy).
 */
public interface IGetLeaderboardUseCase {
    /**
     * Returns the leaderboard for the given [type] and [period].
     *
     * @param type The metric to rank by.
     * @param period The time window to aggregate over.
     * @param campaignId Required when [type] is [LeaderboardType.CAMPAIGN_SPECIFIC].
     * @param limit Maximum number of entries to return.
     * @param requestingPlayerId When provided, appends the requesting player's own rank.
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
