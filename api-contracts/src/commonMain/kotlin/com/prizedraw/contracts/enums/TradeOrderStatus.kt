package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

@Serializable
public enum class TradeOrderStatus {
    LISTED,
    COMPLETED,
    CANCELLED,
}
