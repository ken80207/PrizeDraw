package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

@Serializable
public enum class PrizeState {
    HOLDING,
    TRADING,
    EXCHANGING,
    PENDING_BUYBACK,
    PENDING_SHIPMENT,
    SHIPPED,
    DELIVERED,
    SOLD,
    RECYCLED,
}
