package com.prizedraw.contracts.dto.coupon

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class CouponDto(
    val id: String,
    val name: String,
    val discountRateBps: Int,
    val applicableType: String,
    val validFrom: Instant,
    val validUntil: Instant?,
    val maxUsesPerPlayer: Int,
    val isActive: Boolean,
)

@Serializable
public data class PlayerCouponDto(
    val id: String,
    val couponId: String,
    val couponName: String,
    val discountRateBps: Int,
    val isUsed: Boolean,
    val usedAt: Instant?,
    val acquiredAt: Instant,
)

@Serializable
public data class ApplyCouponRequest(
    val playerCouponId: String,
)

@Serializable
public data class RedeemDiscountCodeRequest(
    val code: String,
)
