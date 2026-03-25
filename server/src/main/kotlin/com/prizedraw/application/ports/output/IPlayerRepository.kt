package com.prizedraw.application.ports.output

import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.valueobjects.PhoneNumber
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Output port for persisting and querying [Player] entities.
 *
 * All database-interacting operations are `suspend` functions to integrate with the Ktor /
 * coroutine execution model. Implementations live in the infrastructure layer.
 */
public interface IPlayerRepository {
    /**
     * Finds a [Player] by their surrogate primary key.
     *
     * Soft-deleted players ([Player.deletedAt] non-null) are excluded.
     *
     * @param id The player's unique identifier.
     * @return The matching [Player], or null if not found.
     */
    public suspend fun findById(id: PlayerId): Player?

    /**
     * Finds a [Player] by their OAuth2 provider and subject identifier.
     *
     * The composite `(provider, subject)` pair is globally unique.
     *
     * @param provider The OAuth2 provider enum value.
     * @param subject The provider-issued `sub` claim.
     * @return The matching [Player], or null if not found.
     */
    public suspend fun findByOAuth(
        provider: OAuthProvider,
        subject: String,
    ): Player?

    /**
     * Finds a [Player] by their verified E.164 phone number.
     *
     * @param phone The validated phone number value object.
     * @return The matching [Player], or null if not found.
     */
    public suspend fun findByPhone(phone: PhoneNumber): Player?

    /**
     * Persists a [Player] entity (insert or update).
     *
     * @param player The player to persist.
     * @return The persisted player (may include server-generated fields such as [Player.createdAt]).
     */
    public suspend fun save(player: Player): Player

    /**
     * Atomically updates both point balances using optimistic locking.
     *
     * The UPDATE is conditional on the [Player.version] column matching [expectedVersion].
     * If the version has been incremented by a concurrent transaction, this method returns
     * false and the caller must retry.
     *
     * @param id The player whose balances to update.
     * @param drawPointsDelta Signed change in draw points (negative = debit).
     * @param revenuePointsDelta Signed change in revenue points (negative = debit).
     * @param expectedVersion The [Player.version] the caller observed before this update.
     * @return True if the update was applied, false if the version check failed.
     */
    public suspend fun updateBalance(
        id: PlayerId,
        drawPointsDelta: Int,
        revenuePointsDelta: Int,
        expectedVersion: Int,
    ): Boolean

    /**
     * Returns a paginated list of all non-deleted players ordered by creation time descending.
     *
     * @param offset Zero-based record offset for pagination.
     * @param limit Maximum number of records to return.
     * @return A page of players.
     */
    public suspend fun findAll(
        offset: Int,
        limit: Int,
    ): List<Player>
}
