package com.prizedraw.application.ports.input.draw

import com.prizedraw.contracts.dto.draw.UnlimitedDrawResultDto
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Input port for executing a probability-based unlimited draw.
 *
 * Unlike kuji, there is no ticket pool and no queue. The caller supplies the
 * target campaign and an optional player coupon. Rate limiting is enforced
 * server-side via a Redis sliding window.
 */
public interface IDrawUnlimitedUseCase {
    /**
     * Executes a single unlimited draw on behalf of [playerId].
     *
     * @param playerId The authenticated player performing the draw.
     * @param campaignId The unlimited campaign to draw from.
     * @param playerCouponId Optional coupon to apply for a discount. Null if none.
     * @return An [UnlimitedDrawResultDto] describing the won prize.
     * @throws com.prizedraw.application.usecases.draw.UnlimitedRateLimitExceededException
     *   if the player exceeds the campaign's [rateLimitPerSecond].
     * @throws com.prizedraw.application.usecases.draw.InsufficientPointsException
     *   if the player's draw-point balance is insufficient.
     * @throws com.prizedraw.application.usecases.draw.UnlimitedCampaignNotFoundException
     *   if no active unlimited campaign matches [campaignId].
     */
    public suspend fun execute(
        playerId: PlayerId,
        campaignId: UUID,
        playerCouponId: UUID?,
    ): UnlimitedDrawResultDto
}
