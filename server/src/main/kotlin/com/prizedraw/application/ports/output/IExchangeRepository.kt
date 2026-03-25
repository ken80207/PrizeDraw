package com.prizedraw.application.ports.output

import com.prizedraw.contracts.enums.ExchangeRequestStatus
import com.prizedraw.domain.entities.ExchangeRequest
import com.prizedraw.domain.entities.ExchangeRequestItem
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Output port for persisting and querying [ExchangeRequest] and [ExchangeRequestItem] entities.
 */
public interface IExchangeRepository {
    /**
     * Finds an [ExchangeRequest] by its surrogate primary key.
     *
     * @param id The exchange request identifier.
     * @return The matching [ExchangeRequest], or null if not found.
     */
    public suspend fun findById(id: UUID): ExchangeRequest?

    /**
     * Returns all exchange requests where the given player is either the initiator or recipient,
     * optionally filtered by status.
     *
     * @param playerId The player to query requests for.
     * @param status When non-null, restricts results to this status.
     * @return List of exchange requests involving this player.
     */
    public suspend fun findByPlayer(
        playerId: PlayerId,
        status: ExchangeRequestStatus? = null,
    ): List<ExchangeRequest>

    /**
     * Returns all active (PENDING or COUNTER_PROPOSED) exchange requests.
     *
     * @param offset Zero-based record offset for pagination.
     * @param limit Maximum number of records to return.
     * @return A page of active exchange requests.
     */
    public suspend fun findActiveRequests(
        offset: Int,
        limit: Int,
    ): List<ExchangeRequest>

    /**
     * Persists an [ExchangeRequest] entity (insert or update).
     *
     * @param request The exchange request to persist.
     * @return The persisted request.
     */
    public suspend fun save(request: ExchangeRequest): ExchangeRequest

    /**
     * Returns all [ExchangeRequestItem]s associated with the given exchange request.
     *
     * @param requestId The parent request identifier.
     * @return All items offered by both parties in this request.
     */
    public suspend fun findItemsByRequest(requestId: UUID): List<ExchangeRequestItem>

    /**
     * Persists a collection of [ExchangeRequestItem]s for a request.
     *
     * @param items The items to persist.
     * @return The persisted items.
     */
    public suspend fun saveItems(items: List<ExchangeRequestItem>): List<ExchangeRequestItem>
}
