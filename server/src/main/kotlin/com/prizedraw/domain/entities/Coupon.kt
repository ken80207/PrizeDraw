package com.prizedraw.domain.entities

import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * Discount type applied by a [Coupon].
 */
public enum class CouponDiscountType {
    /** A percentage discount, e.g. 20% off. [Coupon.discountValue] = 20 means 20%. */
    PERCENTAGE,

    /** A fixed number of draw points deducted from the price. */
    FIXED_POINTS,
}

/**
 * Campaign types a [Coupon] can be applied to.
 */
public enum class CouponApplicableTo {
    /** Applicable to all campaign types. */
    ALL,

    /** Applicable to Kuji campaigns only. */
    KUJI_ONLY,

    /** Applicable to Unlimited campaigns only. */
    UNLIMITED_ONLY,
}

/**
 * Status of a [PlayerCoupon] instance in a player's wallet.
 */
public enum class PlayerCouponStatus {
    /** The coupon is available for use. */
    ACTIVE,

    /** The player has used this coupon the maximum number of times. */
    EXHAUSTED,

    /** The coupon's validity period has passed. */
    EXPIRED,
}

/**
 * A discount template created by operators (優惠券).
 *
 * Multiple players can hold instances of the same coupon via [PlayerCoupon]. Coupons can be
 * distributed automatically (system push) or redeemed via a [DiscountCode].
 *
 * @property id Surrogate primary key.
 * @property name Internal coupon name.
 * @property description Player-facing description. Null if not set.
 * @property discountType Type of discount applied.
 * @property discountValue For PERCENTAGE: 1–99 (inclusive); for FIXED_POINTS: positive integer.
 * @property applicableTo Which campaign types accept this coupon.
 * @property maxUsesPerPlayer Maximum times a single player may use this coupon.
 * @property totalIssued Total [PlayerCoupon] rows created from this coupon.
 * @property totalUsed Total times this coupon was applied to a draw.
 * @property issueLimit Maximum total issues allowed. Null means unlimited.
 * @property validFrom Coupon becomes usable from this time.
 * @property validUntil Coupon expires at this time.
 * @property isActive Operator can disable without deleting.
 * @property createdByStaffId FK to the Staff member who created this coupon.
 * @property deletedAt Soft-delete timestamp.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class Coupon(
    val id: UUID,
    val name: String,
    val description: String?,
    val discountType: CouponDiscountType,
    val discountValue: Int,
    val applicableTo: CouponApplicableTo,
    val maxUsesPerPlayer: Int,
    val totalIssued: Int,
    val totalUsed: Int,
    val issueLimit: Int?,
    val validFrom: Instant,
    val validUntil: Instant,
    val isActive: Boolean,
    val createdByStaffId: UUID,
    val deletedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/**
 * A redeemable code string that, when entered by a player, issues them a [PlayerCoupon]
 * from the associated [Coupon] template (折扣碼).
 *
 * Codes are stored uppercase and looked up case-insensitively.
 *
 * @property id Surrogate primary key.
 * @property couponId FK to the [Coupon] issued on redemption.
 * @property code Case-insensitive redemption code stored in uppercase.
 * @property redemptionLimit Total redemptions allowed. Null means unlimited.
 * @property redemptionCount Current redemption count.
 * @property isActive Operator can deactivate without deleting.
 * @property deletedAt Soft-delete timestamp.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class DiscountCode(
    val id: UUID,
    val couponId: UUID,
    val code: String,
    val redemptionLimit: Int?,
    val redemptionCount: Int,
    val isActive: Boolean,
    val deletedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/**
 * A specific coupon instance in a player's wallet (玩家優惠券).
 *
 * Tracks per-instance usage. Transitions to [PlayerCouponStatus.EXHAUSTED] when
 * [useCount] >= [Coupon.maxUsesPerPlayer], and to [PlayerCouponStatus.EXPIRED] when
 * the current time exceeds [Coupon.validUntil].
 *
 * @property id Surrogate primary key.
 * @property playerId FK to the coupon holder [Player].
 * @property couponId FK to the source [Coupon] template.
 * @property discountCodeId FK to the [DiscountCode] used for redemption. Null if system-issued.
 * @property useCount How many times this coupon instance has been applied.
 * @property status Current coupon wallet state.
 * @property issuedAt When this coupon was added to the player's wallet.
 * @property lastUsedAt Last draw time this coupon was applied.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class PlayerCoupon(
    val id: UUID,
    val playerId: PlayerId,
    val couponId: UUID,
    val discountCodeId: UUID?,
    val useCount: Int,
    val status: PlayerCouponStatus,
    val issuedAt: Instant,
    val lastUsedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)
