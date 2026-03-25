package com.prizedraw.application.ports.input.shipping

import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Input port for confirming delivery of a SHIPPED order.
 *
 * May be invoked by the player or by a scheduled auto-confirm job.
 */
public interface IConfirmDeliveryUseCase {
    /**
     * Marks the shipping order as DELIVERED.
     *
     * Validates that the order is in SHIPPED state. When [playerId] is non-null, also
     * validates that the order belongs to that player.
     *
     * @param orderId The shipping order to confirm.
     * @param playerId Optional player context for ownership validation.
     */
    public suspend fun execute(
        orderId: UUID,
        playerId: PlayerId? = null,
    )
}
