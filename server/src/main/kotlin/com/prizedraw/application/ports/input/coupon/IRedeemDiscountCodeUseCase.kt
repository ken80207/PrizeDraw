package com.prizedraw.application.ports.input.coupon

import com.prizedraw.domain.entities.PlayerCoupon
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for redeeming a discount code.
 *
 * Looks up the [com.prizedraw.domain.entities.DiscountCode] by code string, validates it,
 * and creates a [PlayerCoupon] in the player's wallet.
 */
public interface IRedeemDiscountCodeUseCase {
    /**
     * Redeems a discount code and issues a [PlayerCoupon] to the player.
     *
     * @param playerId The authenticated player redeeming the code.
     * @param code The discount code string entered by the player.
     * @return The newly created [PlayerCoupon].
     */
    public suspend fun execute(
        playerId: PlayerId,
        code: String,
    ): PlayerCoupon
}
