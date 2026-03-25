package com.prizedraw.application.ports.input.shipping

import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Input port for cancelling a PENDING_SHIPMENT shipping order.
 */
public interface ICancelShippingOrderUseCase {
    /**
     * Cancels the shipping order identified by [orderId].
     *
     * Validates that the order is in PENDING_SHIPMENT state. In a single DB transaction:
     * sets the order status to CANCELLED and restores the prize state to HOLDING.
     *
     * @param playerId The requesting player's identifier.
     * @param orderId The shipping order to cancel.
     * @throws com.prizedraw.application.usecases.shipping.ShippingNotFoundException if not found.
     * @throws com.prizedraw.application.usecases.shipping.CancellationNotAllowedException if
     *   the order is not in PENDING_SHIPMENT state or does not belong to the player.
     */
    public suspend fun execute(
        playerId: PlayerId,
        orderId: UUID,
    )
}
