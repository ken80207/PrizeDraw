package com.prizedraw.application.ports.output

import com.prizedraw.contracts.enums.WithdrawalStatus
import com.prizedraw.domain.entities.WithdrawalRequest
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Output port for persisting and querying [WithdrawalRequest] entities.
 */
public interface IWithdrawalRepository {
    /**
     * Finds a [WithdrawalRequest] by its surrogate primary key.
     *
     * @param id The withdrawal request identifier.
     * @return The matching [WithdrawalRequest], or null if not found.
     */
    public suspend fun findById(id: UUID): WithdrawalRequest?

    /**
     * Returns all withdrawal requests for a player, ordered by creation time descending.
     *
     * @param playerId The player's identifier.
     * @param offset   Zero-based record offset for pagination.
     * @param limit    Maximum records to return.
     * @return A page of withdrawal requests.
     */
    public suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<WithdrawalRequest>

    /**
     * Returns all withdrawal requests matching the given status (for admin review).
     *
     * @param status The status to filter by.
     * @param offset Zero-based record offset for pagination.
     * @param limit  Maximum records to return.
     * @return A page of withdrawal requests.
     */
    public suspend fun findByStatus(
        status: WithdrawalStatus,
        offset: Int,
        limit: Int,
    ): List<WithdrawalRequest>

    /**
     * Persists a [WithdrawalRequest] entity (insert or update).
     *
     * @param request The request to persist.
     * @return The persisted request.
     */
    public suspend fun save(request: WithdrawalRequest): WithdrawalRequest
}
