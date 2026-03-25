package com.prizedraw.api.mappers

import com.prizedraw.contracts.dto.shipping.ShippingOrderDto
import com.prizedraw.domain.entities.ShippingOrder

/**
 * Maps a [ShippingOrder] domain entity to its [ShippingOrderDto] representation.
 */
public fun ShippingOrder.toDto(): ShippingOrderDto =
    ShippingOrderDto(
        id = id.toString(),
        prizeInstanceId = prizeInstanceId.value.toString(),
        recipientName = recipientName,
        recipientPhone = recipientPhone,
        addressLine1 = addressLine1,
        addressLine2 = addressLine2,
        city = city,
        postalCode = postalCode,
        countryCode = countryCode,
        trackingNumber = trackingNumber,
        carrier = carrier,
        status = status,
        shippedAt = shippedAt,
        deliveredAt = deliveredAt,
    )
