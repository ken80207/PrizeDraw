package com.prizedraw.application.ports.input.shipping

import com.prizedraw.contracts.dto.shipping.CreateShippingOrderRequest
import com.prizedraw.contracts.dto.shipping.ShippingOrderDto
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for creating a new shipping order for a HOLDING prize.
 */
public interface ICreateShippingOrderUseCase {
    /**
     * Creates a shipping order for the prize identified in [request].
     *
     * Validates that the prize is in HOLDING state and belongs to [playerId].
     * In a single DB transaction: creates the order and transitions the prize to
     * PENDING_SHIPMENT state.
     *
     * @param playerId The requesting player's identifier.
     * @param request Address and prize details.
     * @return The persisted [ShippingOrderDto].
     */
    public suspend fun execute(
        playerId: PlayerId,
        request: CreateShippingOrderRequest,
    ): ShippingOrderDto
}
