package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

@Serializable
public enum class ShippingOrderStatus {
    PENDING_SHIPMENT,
    SHIPPED,
    DELIVERED,
    CANCELLED,
}
