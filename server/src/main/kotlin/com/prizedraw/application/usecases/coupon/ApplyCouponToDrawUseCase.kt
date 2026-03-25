package com.prizedraw.application.usecases.coupon

import com.prizedraw.application.ports.input.coupon.CouponApplicationResult
import com.prizedraw.application.ports.input.coupon.IApplyCouponToDrawUseCase
import com.prizedraw.application.ports.output.ICouponRepository
import com.prizedraw.domain.entities.CouponApplicableTo
import com.prizedraw.domain.entities.CouponDiscountType
import com.prizedraw.domain.entities.PlayerCouponStatus
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import java.util.UUID

private const val PERCENTAGE_DENOMINATOR = 100.0

/** Thrown when the player coupon is not found or not owned by the calling player. */
public class PlayerCouponNotFoundException(
    id: UUID,
) : IllegalArgumentException("PlayerCoupon $id not found")

/** Thrown when the player coupon has already been fully used. */
public class CouponAlreadyUsedException(
    id: UUID,
) : IllegalStateException("PlayerCoupon $id has already been used")

/** Thrown when the coupon is not compatible with the requested campaign type. */
public class CouponNotApplicableException(
    campaignType: CouponApplicableTo,
    required: CouponApplicableTo,
) : IllegalStateException("Coupon is not applicable to $campaignType (requires $required)")

/**
 * Validates a player coupon and computes the discounted draw price.
 *
 * Does NOT mark the coupon as used — the actual draw transaction handles that atomically.
 */
public class ApplyCouponToDrawUseCase(
    private val couponRepository: ICouponRepository,
) : IApplyCouponToDrawUseCase {
    override suspend fun execute(
        playerId: PlayerId,
        playerCouponId: UUID,
        originalPrice: Int,
        campaignType: CouponApplicableTo,
    ): CouponApplicationResult {
        val playerCoupon =
            couponRepository.findPlayerCouponById(playerCouponId)
                ?: throw PlayerCouponNotFoundException(playerCouponId)
        if (playerCoupon.playerId != playerId) {
            throw PlayerCouponNotFoundException(playerCouponId)
        }
        if (playerCoupon.status != PlayerCouponStatus.ACTIVE) {
            throw CouponAlreadyUsedException(playerCouponId)
        }
        val coupon =
            couponRepository.findCouponById(playerCoupon.couponId)
                ?: throw CouponNotAvailableException(playerCoupon.couponId)
        val now = Clock.System.now()
        if (!coupon.isActive || now > coupon.validUntil || now < coupon.validFrom) {
            throw CouponNotAvailableException(coupon.id)
        }
        if (playerCoupon.useCount >= coupon.maxUsesPerPlayer) {
            throw CouponAlreadyUsedException(playerCouponId)
        }
        checkCouponCompatibility(coupon.applicableTo, campaignType)
        val discountedPrice = computeDiscountedPrice(coupon.discountType, coupon.discountValue, originalPrice)
        return CouponApplicationResult(
            playerCouponId = playerCouponId,
            originalPrice = originalPrice,
            discountedPrice = discountedPrice,
            discountAmount = originalPrice - discountedPrice,
        )
    }

    private fun checkCouponCompatibility(
        couponApplicableTo: CouponApplicableTo,
        campaignType: CouponApplicableTo,
    ) {
        if (couponApplicableTo == CouponApplicableTo.ALL) {
            return
        }
        if (couponApplicableTo != campaignType) {
            throw CouponNotApplicableException(campaignType, couponApplicableTo)
        }
    }

    private fun computeDiscountedPrice(
        discountType: CouponDiscountType,
        discountValue: Int,
        originalPrice: Int,
    ): Int =
        when (discountType) {
            CouponDiscountType.PERCENTAGE -> {
                val factor = (PERCENTAGE_DENOMINATOR - discountValue) / PERCENTAGE_DENOMINATOR
                (originalPrice * factor).toLong().toInt().coerceAtLeast(0)
            }
            CouponDiscountType.FIXED_POINTS ->
                (originalPrice - discountValue).coerceAtLeast(0)
        }
}
