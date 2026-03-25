package com.prizedraw.application.ports.input.coupon

import com.prizedraw.domain.entities.CouponApplicableTo
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/** Result of applying a coupon to a draw price. */
public data class CouponApplicationResult(
    val playerCouponId: UUID,
    val originalPrice: Int,
    val discountedPrice: Int,
    val discountAmount: Int,
)

/**
 * Input port for validating and previewing a coupon application before committing the draw.
 *
 * Validates:
 * - [PlayerCoupon] exists and belongs to the calling player.
 * - [PlayerCoupon] is not already used (useCount < maxUsesPerPlayer).
 * - [Coupon] is active and not expired.
 * - [Coupon.applicableTo] is compatible with the draw campaign type.
 *
 * Does NOT mark the coupon as used — the draw use case does that atomically.
 */
public interface IApplyCouponToDrawUseCase {
    /**
     * Validates the coupon and computes the discounted price.
     *
     * @param playerId The player applying the coupon.
     * @param playerCouponId The player's coupon instance ID.
     * @param originalPrice The full draw price in draw points.
     * @param campaignType The campaign type to check compatibility.
     * @return A [CouponApplicationResult] with the computed discounted price.
     */
    public suspend fun execute(
        playerId: PlayerId,
        playerCouponId: UUID,
        originalPrice: Int,
        campaignType: CouponApplicableTo,
    ): CouponApplicationResult
}
