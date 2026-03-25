package com.prizedraw.application.ports.input.shipping

import java.util.UUID

/**
 * Input port for fulfilling a PENDING_SHIPMENT order (admin/operator action).
 */
public interface IFulfillShippingOrderUseCase {
    /**
     * Records the tracking number and carrier, marks the order as SHIPPED.
     *
     * @param orderId The shipping order to fulfill.
     * @param trackingNumber Courier tracking number.
     * @param carrier Carrier name.
     * @param staffId The staff member performing the fulfillment.
     */
    public suspend fun execute(
        orderId: UUID,
        trackingNumber: String,
        carrier: String,
        staffId: UUID,
    )
}
