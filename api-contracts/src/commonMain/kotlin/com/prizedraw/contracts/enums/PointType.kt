package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

/** Transaction types for a player's draw-point (spend-point) wallet. */
@Serializable
public enum class DrawPointTxType {
    PURCHASE_CREDIT,
    KUJI_DRAW_DEBIT,
    UNLIMITED_DRAW_DEBIT,
    TRADE_PURCHASE_DEBIT,
    COUPON_DISCOUNT_CREDIT,
    REFUND_CREDIT,
    ADMIN_ADJUSTMENT,
}

/** Transaction types for a player's revenue-point wallet. */
@Serializable
public enum class RevenuePointTxType {
    TRADE_SALE_CREDIT,
    BUYBACK_CREDIT,
    WITHDRAWAL_DEBIT,
    ADMIN_ADJUSTMENT,
}
