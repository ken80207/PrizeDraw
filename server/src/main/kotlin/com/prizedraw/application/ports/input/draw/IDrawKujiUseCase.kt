package com.prizedraw.application.ports.input.draw

import com.prizedraw.contracts.dto.draw.DrawResultDto
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Input port for executing a kuji draw.
 *
 * The caller must supply the player's identity (from the JWT principal), the target
 * ticket box, and — for a directed draw — the specific ticket IDs to draw. For a
 * random multi-draw, [ticketIds] is empty and [quantity] drives ticket selection.
 */
public interface IDrawKujiUseCase {
    /**
     * Executes a kuji draw on behalf of [playerId].
     *
     * @param playerId The authenticated player performing the draw.
     * @param ticketBoxId The ticket box to draw from.
     * @param ticketIds Explicit ticket IDs for directed draws. Empty for random selection.
     * @param quantity Number of tickets to draw. Ignored when [ticketIds] is non-empty.
     * @param playerCouponId Optional player coupon to apply for a discount. Null if none.
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
