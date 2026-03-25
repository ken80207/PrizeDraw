package com.prizedraw.application.ports.output

import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.UnlimitedCampaign
import com.prizedraw.domain.valueobjects.CampaignId

/**
 * Output port for persisting and querying Kuji and Unlimited campaign entities.
 *
 * Kuji and Unlimited campaigns are separate aggregate roots stored in separate tables,
 * so their CRUD operations are segregated accordingly.
 */
@Suppress("TooManyFunctions")
public interface ICampaignRepository {
    // --- Kuji Campaign ---

    /**
     * Finds a [KujiCampaign] by its surrogate primary key.
     *
     * Soft-deleted campaigns ([KujiCampaign.deletedAt] non-null) are excluded.
     *
     * @param id The campaign's unique identifier.
     * @return The matching [KujiCampaign], or null if not found.
     */
    public suspend fun findKujiById(id: CampaignId): KujiCampaign?

    /**
     * Returns all [KujiCampaign]s with [CampaignStatus.ACTIVE] status.
     *
     * @return Non-deleted, active kuji campaigns.
     */
    public suspend fun findActiveKujiCampaigns(): List<KujiCampaign>

    /**
     * Persists a [KujiCampaign] entity (insert or update).
     *
     * @param campaign The campaign to persist.
     * @return The persisted campaign.
     */
    public suspend fun saveKuji(campaign: KujiCampaign): KujiCampaign

    /**
     * Updates only the [status] column of a [KujiCampaign].
     *
     * Used for lifecycle transitions (DRAFT → ACTIVE, ACTIVE → SUSPENDED, etc.).
     *
     * @param id The campaign to update.
     * @param status The new status to apply.
     */
    public suspend fun updateKujiStatus(
        id: CampaignId,
        status: CampaignStatus,
    )

    /**
     * Returns all [KujiCampaign]s, optionally filtered by [status].
     *
     * Used by admin list endpoints. Soft-deleted campaigns are excluded.
     *
     * @param status When non-null, restricts results to campaigns with this status.
     * @return List of campaigns ordered by [KujiCampaign.createdAt] descending.
     */
    public suspend fun findAllKuji(status: CampaignStatus? = null): List<KujiCampaign>

    // --- Unlimited Campaign ---

    /**
     * Finds an [UnlimitedCampaign] by its surrogate primary key.
     *
     * Soft-deleted campaigns are excluded.
     *
     * @param id The campaign's unique identifier.
     * @return The matching [UnlimitedCampaign], or null if not found.
     */
    public suspend fun findUnlimitedById(id: CampaignId): UnlimitedCampaign?

    /**
     * Returns all [UnlimitedCampaign]s with [CampaignStatus.ACTIVE] status.
     *
     * @return Non-deleted, active unlimited campaigns.
     */
    public suspend fun findActiveUnlimitedCampaigns(): List<UnlimitedCampaign>

    /**
     * Persists an [UnlimitedCampaign] entity (insert or update).
     *
     * @param campaign The campaign to persist.
     * @return The persisted campaign.
     */
    public suspend fun saveUnlimited(campaign: UnlimitedCampaign): UnlimitedCampaign

    /**
     * Returns all [UnlimitedCampaign]s, optionally filtered by [status].
     *
     * Used by admin list endpoints. Soft-deleted campaigns are excluded.
     *
     * @param status When non-null, restricts results to campaigns with this status.
     * @return List of campaigns ordered by [UnlimitedCampaign.createdAt] descending.
     */
    public suspend fun findAllUnlimited(status: CampaignStatus? = null): List<UnlimitedCampaign>

    /**
     * Updates only the [status] column of an [UnlimitedCampaign].
     *
     * @param id The campaign to update.
     * @param status The new status to apply.
     */
    public suspend fun updateUnlimitedStatus(
        id: CampaignId,
        status: CampaignStatus,
    )
}
