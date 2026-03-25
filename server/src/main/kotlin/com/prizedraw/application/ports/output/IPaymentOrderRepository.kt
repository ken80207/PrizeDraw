package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.PaymentOrder
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Output port for persisting and querying [PaymentOrder] entities.
 */
public interface IPaymentOrderRepository {
    /**
     * Finds a [PaymentOrder] by its surrogate primary key.
     *
     * @param id The payment order UUID.
     * @return The matching [PaymentOrder], or null if not found.
     */
    public suspend fun findById(id: UUID): PaymentOrder?

    /**
     * Finds a [PaymentOrder] by the gateway's transaction reference.
     *
     * @param gatewayTransactionId The gateway-issued transaction ID.
     * @return The matching [PaymentOrder], or null if not found.
     */
    public suspend fun findByGatewayTransactionId(gatewayTransactionId: String): PaymentOrder?

    /**
     * Persists a [PaymentOrder] entity (insert or update).
     *
     * @param order The payment order to persist.
     * @return The persisted order with any server-generated fields applied.
     */
    public suspend fun save(order: PaymentOrder): PaymentOrder

    /**
     * Returns all payment orders for a given player, ordered by creation time descending.
     *
     * @param playerId The player's identifier.
     * @param offset Zero-based record offset for pagination.
     * @param limit Maximum number of records to return.
     * @return A page of payment orders.
     */
    public suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<PaymentOrder>
}
