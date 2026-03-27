package com.prizedraw.application.ports.output

import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.PrizeInstance
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId

/**
 * Output port for persisting and querying [PrizeDefinition] and [PrizeInstance] entities.
 */
public interface IPrizeRepository {
    // --- Prize Definitions ---

    /**
     * Finds a [PrizeDefinition] by its surrogate primary key.
     *
     * @param id The definition identifier.
     * @return The matching [PrizeDefinition], or null if not found.
     */
    public suspend fun findDefinitionById(id: PrizeDefinitionId): PrizeDefinition?

    /**
     * Returns all [PrizeDefinition]s for the given campaign, optionally filtered by type.
     *
     * @param campaignId The parent campaign identifier.
     * @param type When non-null, restricts results to definitions for this campaign type.
     * @return Ordered list of prize definitions for the campaign.
     */
    public suspend fun findDefinitionsByCampaign(
        campaignId: CampaignId,
        type: CampaignType? = null,
    ): List<PrizeDefinition>

    // --- Prize Instances ---

    /**
     * Finds a [PrizeInstance] by its surrogate primary key.
     *
     * Soft-deleted instances ([PrizeInstance.deletedAt] non-null) are excluded.
     *
     * @param id The instance identifier.
     * @return The matching [PrizeInstance], or null if not found.
     */
    public suspend fun findInstanceById(id: PrizeInstanceId): PrizeInstance?

    /**
     * Returns all [PrizeInstance]s owned by the given player, optionally filtered by state.
     *
     * Soft-deleted instances (in terminal states) are excluded unless [state] explicitly
     * requests a terminal state value.
     *
     * @param ownerId The current owner's identifier.
     * @param state When non-null, restricts results to instances in this state.
     * @return List of the player's prize instances.
     */
    public suspend fun findInstancesByOwner(
        ownerId: PlayerId,
        state: PrizeState? = null,
    ): List<PrizeInstance>

    /**
     * Persists a [PrizeDefinition] entity (insert or update).
     *
     * Used by admin use cases to update buyback price and enabled flag.
     *
     * @param definition The definition to persist.
     * @return The persisted definition.
     */
    public suspend fun saveDefinition(definition: PrizeDefinition): PrizeDefinition

    /**
     * Persists a new [PrizeInstance] entity.
     *
     * @param instance The instance to persist.
     * @return The persisted instance.
     */
    public suspend fun saveInstance(instance: PrizeInstance): PrizeInstance

    /**
     * Atomically updates the [state] of a [PrizeInstance] using an optimistic check.
     *
     * Returns false when the current state does not match [expectedState], indicating
     * a concurrent state transition occurred.
     *
     * @param id The instance to update.
     * @param newState The target state to transition to.
     * @param expectedState The state the caller observed before this update.
     * @return True if the state was updated, false if the check failed.
     */
    public suspend fun updateInstanceState(
        id: PrizeInstanceId,
        newState: PrizeState,
        expectedState: PrizeState,
    ): Boolean

    /**
     * Atomically transfers ownership of a [PrizeInstance] and updates its state.
     *
     * Used during trade completions and exchange executions. Both the [newOwnerId]
     * and the [newState] must be set in the same database transaction.
     *
     * @param instanceId The instance to transfer.
     * @param newOwnerId The new owner's identifier.
     * @param newState The state to assign to the transferred instance.
     * @return The updated [PrizeInstance] with the new owner and state.
     */
    public suspend fun transferOwnership(
        instanceId: PrizeInstanceId,
        newOwnerId: PlayerId,
        newState: PrizeState,
    ): PrizeInstance

    /**
     * Deletes all [PrizeDefinition]s associated with the given unlimited campaign.
     *
     * Used when replacing prize definitions during an unlimited campaign update.
     *
     * @param campaignId The unlimited campaign whose definitions should be removed.
     */
    public suspend fun deleteByUnlimitedCampaignId(campaignId: CampaignId)

    /**
     * Persists a batch of [PrizeDefinition]s in a single transaction.
     *
     * All definitions in the list are inserted. Caller is responsible for ensuring
     * no ID conflicts exist (e.g. by calling [deleteByUnlimitedCampaignId] first).
     *
     * @param definitions The definitions to insert.
     */
    public suspend fun saveAll(definitions: List<PrizeDefinition>)
}
