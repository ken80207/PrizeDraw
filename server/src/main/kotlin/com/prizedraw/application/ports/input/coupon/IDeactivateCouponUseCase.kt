package com.prizedraw.application.ports.input.coupon

import com.prizedraw.domain.entities.Coupon
import com.prizedraw.domain.valueobjects.StaffId
import java.util.UUID

/**
 * Input port for deactivating an existing coupon (admin only).
 *
 * Setting [Coupon.isActive] to false prevents new redemptions but does not
 * invalidate existing [com.prizedraw.domain.entities.PlayerCoupon] instances.
 */
public interface IDeactivateCouponUseCase {
    /**
     * Deactivates the given coupon.
     *
     * @param actorStaffId The staff member performing the deactivation.
     * @param couponId The coupon to deactivate.
     * @return The updated [Coupon] with [Coupon.isActive] set to false.
     */
    public suspend fun execute(
        actorStaffId: StaffId,
        couponId: UUID,
    ): Coupon
}
