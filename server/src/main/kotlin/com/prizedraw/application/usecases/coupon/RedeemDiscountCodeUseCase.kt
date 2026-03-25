package com.prizedraw.application.usecases.coupon

import com.prizedraw.application.ports.input.coupon.IRedeemDiscountCodeUseCase
import com.prizedraw.application.ports.output.ICouponRepository
import com.prizedraw.domain.entities.PlayerCoupon
import com.prizedraw.domain.entities.PlayerCouponStatus
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import java.util.UUID

/** Thrown when the discount code is not found or inactive. */
public class DiscountCodeNotFoundException(
    code: String,
) : IllegalArgumentException("Discount code '$code' not found or inactive")

/** Thrown when the coupon's total supply is exhausted. */
public class CouponSupplyExhaustedException(
    couponId: UUID,
) : IllegalStateException("Coupon $couponId has reached its total supply limit")

/** Thrown when the coupon's redemption limit for this code is reached. */
public class CodeRedemptionLimitReachedException(
    code: String,
) : IllegalStateException("Discount code '$code' redemption limit has been reached")

/** Thrown when the coupon is inactive or expired. */
public class CouponNotAvailableException(
    couponId: UUID,
) : IllegalStateException("Coupon $couponId is not available (inactive or expired)")

/**
 * Redeems a discount code and creates a [PlayerCoupon] in the player's wallet.
 *
 * Validates:
 * - Code exists and is active.
 * - Coupon is active and not expired.
 * - Code redemption count < redemption limit (if set).
 * - Coupon total supply not exceeded (if supply-limited).
 */
public class RedeemDiscountCodeUseCase(
    private val couponRepository: ICouponRepository,
) : IRedeemDiscountCodeUseCase {
    override suspend fun execute(
        playerId: PlayerId,
        code: String,
    ): PlayerCoupon {
        val discountCode =
            couponRepository.findDiscountCodeByCode(code.uppercase().trim())
                ?: throw DiscountCodeNotFoundException(code)
        if (!discountCode.isActive) {
            throw DiscountCodeNotFoundException(code)
        }
        if (discountCode.redemptionLimit != null &&
            discountCode.redemptionCount >= discountCode.redemptionLimit
        ) {
            throw CodeRedemptionLimitReachedException(code)
        }
        val coupon =
            couponRepository.findCouponById(discountCode.couponId)
                ?: throw CouponNotAvailableException(discountCode.couponId)
        val now = Clock.System.now()
        if (!coupon.isActive || now > coupon.validUntil) {
            throw CouponNotAvailableException(coupon.id)
        }
        if (coupon.issueLimit != null && coupon.totalIssued >= coupon.issueLimit) {
            throw CouponSupplyExhaustedException(coupon.id)
        }
        val updatedCode =
            discountCode.copy(
                redemptionCount = discountCode.redemptionCount + 1,
                updatedAt = now,
            )
        couponRepository.saveDiscountCode(updatedCode)
        val updatedCoupon = coupon.copy(totalIssued = coupon.totalIssued + 1, updatedAt = now)
        couponRepository.saveCoupon(updatedCoupon)
        val playerCoupon =
            PlayerCoupon(
                id = UUID.randomUUID(),
                playerId = playerId,
                couponId = coupon.id,
                discountCodeId = discountCode.id,
                useCount = 0,
                status = PlayerCouponStatus.ACTIVE,
                issuedAt = now,
                lastUsedAt = null,
                createdAt = now,
                updatedAt = now,
            )
        return couponRepository.savePlayerCoupon(playerCoupon)
    }
}
