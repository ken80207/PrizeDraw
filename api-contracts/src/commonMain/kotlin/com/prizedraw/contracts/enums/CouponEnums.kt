package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

/** Discount calculation method for a coupon. */
@Serializable
public enum class CouponDiscountType {
    /** A percentage off the draw price (e.g. 20 = 20% off). */
    PERCENTAGE,

    /** A fixed number of draw points deducted from the draw price. */
    FIXED_POINTS,
}

/** Which campaign types a coupon applies to. */
@Serializable
public enum class CouponApplicableTo {
    ALL,
    KUJI_ONLY,
    UNLIMITED_ONLY,
}

/** Per-player coupon instance lifecycle status. */
@Serializable
public enum class PlayerCouponStatus {
    /** The coupon is valid and can still be used. */
    ACTIVE,

    /** The player has exhausted all uses (`use_count >= max_uses_per_player`). */
    EXHAUSTED,

    /** The coupon's validity window has passed. */
    EXPIRED,
}
