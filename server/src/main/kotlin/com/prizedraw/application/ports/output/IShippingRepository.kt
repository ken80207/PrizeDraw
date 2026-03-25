package com.prizedraw.application.ports.output

import com.prizedraw.contracts.enums.ShippingOrderStatus
import com.prizedraw.domain.entities.ShippingOrder
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import java.util.UUID

/**
 * Output port for persisting and querying [ShippingOrder] entities.
 */
public interface IShippingRepository {
    /**
     * Finds a [ShippingOrder] by its surrogate primary key.
     *
     * @param id The shipping order identifier.
     * @return The matching [ShippingOrder], or null if not found.
     */
    public suspend fun findById(id: UUID): ShippingOrder?

    /**
     * Finds the shipping order for a specific prize instance, if one exists.
     *
     * A prize instance can only have one shipping order at a time.
     *
     * @param prizeInstanceId The prize instance to query.
     * @return The shipping order, or null if no order exists for this prize.
     */
    public suspend fun findByPrizeInstance(prizeInstanceId: PrizeInstanceId): ShippingOrder?

    /**
     * Returns all shipping orders for the given player, optionally filtered by status.
     *
     * @param playerId The player's identifier.
     * @param status When non-null, restricts results to this status.
     * @param offset Zero-based record offset for pagination.
     * @param limit Maximum number of records to return.
     * @return A page of shipping orders for this player.
     */
    public suspend fun findByPlayer(
        playerId: PlayerId,
        status: ShippingOrderStatus? = null,
        offset: Int,
        limit: Int,
    ): List<ShippingOrder>

    /**
     * Returns all shipping orders in the given status, ordered by creation time ascending.
     *
     * Used by the back-office fulfillment queue.
     *
     * @param status The status to filter by.
     * @param offset Zero-based record offset for pagination.
     * @param limit Maximum number of records to return.
     * @return A page of shipping orders in the given status.
     */
    public suspend fun findByStatus(
        status: ShippingOrderStatus,
        offset: Int,
        limit: Int,
    ): List<ShippingOrder>

    /**
     * Persists a [ShippingOrder] entity (insert or update).
     *
     * @param order The shipping order to persist.
     * @return The persisted order.
     */
    public suspend fun save(order: ShippingOrder): ShippingOrder
}
