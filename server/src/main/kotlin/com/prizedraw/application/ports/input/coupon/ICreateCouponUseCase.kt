package com.prizedraw.application.ports.input.coupon

import com.prizedraw.domain.entities.Coupon
import com.prizedraw.domain.entities.CouponApplicableTo
import com.prizedraw.domain.entities.CouponDiscountType
import com.prizedraw.domain.entities.DiscountCode
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Instant

/** Result of coupon creation, including an optional discount code. */
public data class CreateCouponResult(
    val coupon: Coupon,
    val discountCode: DiscountCode?,
)

/**
 * Parameters for creating a new coupon template.
 *
 * @property actorStaffId The staff member creating the coupon.
 * @property name Display name for the coupon.
 * @property description Optional player-facing description.
 * @property discountType Type of discount applied.
 * @property discountValue Percentage (1–99) or fixed points amount.
 * @property applicableTo Which campaign types accept this coupon.
 * @property maxUsesPerPlayer Maximum uses per player instance.
 * @property issueLimit Total issuable instances cap. Null for unlimited.
 * @property validFrom Coupon becomes usable from this instant.
 * @property validUntil Coupon expires at this instant.
 * @property discountCode Optional alphanumeric code string to attach (uppercase-stored).
 * @property codeRedemptionLimit Max redemptions for the attached code. Null for unlimited.
 */
public data class CreateCouponParams(
    val actorStaffId: StaffId,
    val name: String,
    val description: String?,
    val discountType: CouponDiscountType,
    val discountValue: Int,
    val applicableTo: CouponApplicableTo,
    val maxUsesPerPlayer: Int,
    val issueLimit: Int?,
    val validFrom: Instant,
    val validUntil: Instant,
    val discountCode: String?,
    val codeRedemptionLimit: Int?,
)

/**
 * Input port for creating a new coupon template (admin only).
 *
 * Optionally attaches a single [DiscountCode] record during creation.
 */
public interface ICreateCouponUseCase {
    /**
     * Creates a [Coupon] and optionally a linked [DiscountCode].
     *
     * @param params All parameters required to create the coupon.
     * @return The created [CreateCouponResult].
     */
    public suspend fun execute(params: CreateCouponParams): CreateCouponResult
}
