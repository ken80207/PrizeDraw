package com.prizedraw.contracts.dto.shipping

import com.prizedraw.contracts.enums.ShippingOrderStatus
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class ShippingOrderDto(
    val id: String,
    val prizeInstanceId: String,
    val recipientName: String,
    val recipientPhone: String,
    val addressLine1: String,
    val addressLine2: String?,
    val city: String,
    val postalCode: String,
    val countryCode: String,
    val trackingNumber: String?,
    val carrier: String?,
    val status: ShippingOrderStatus,
    val shippedAt: Instant?,
    val deliveredAt: Instant?,
)

@Serializable
public data class CreateShippingOrderRequest(
    val prizeInstanceId: String,
    val recipientName: String,
    val recipientPhone: String,
    val addressLine1: String,
    val addressLine2: String? = null,
    val city: String,
    val postalCode: String,
    val countryCode: String,
)

@Serializable
public data class UpdateShippingRequest(
    val trackingNumber: String,
    val carrier: String,
)

@Serializable
public data class ConfirmDeliveryRequest(
    val shippingOrderId: String,
)
