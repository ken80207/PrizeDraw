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

    // --- Batch lookups ---

    /**
     * Fetches multiple [KujiCampaign]s by their IDs in a single query.
     *
     * Soft-deleted campaigns are excluded. The order of results is not guaranteed.
     *
     * @param ids The campaign IDs to fetch.
     * @return All non-deleted campaigns whose IDs appear in [ids].
     */
    public suspend fun findKujiByIds(ids: List<CampaignId>): List<KujiCampaign>

    /**
     * Fetches multiple [UnlimitedCampaign]s by their IDs in a single query.
     *
     * Soft-deleted campaigns are excluded. The order of results is not guaranteed.
     *
     * @param ids The campaign IDs to fetch.
     * @return All non-deleted campaigns whose IDs appear in [ids].
     */
    public suspend fun findUnlimitedByIds(ids: List<CampaignId>): List<UnlimitedCampaign>

    /**
     * Returns all active [KujiCampaign]s that have not yet had a low-stock notification dispatched.
     *
     * Used by the low-stock notification worker to identify campaigns requiring a notification.
     *
     * @return Active campaigns with [KujiCampaign.lowStockNotifiedAt] equal to null.
     */
    public suspend fun findActiveKujiCampaignsNotLowStockNotified(): List<KujiCampaign>

    /**
     * Returns the total number of tickets across all ticket boxes for a campaign.
     *
     * @param campaignId The campaign's unique identifier.
     * @return Sum of [TicketBox.totalTickets] for all boxes belonging to this campaign.
     */
    public suspend fun countTotalTickets(campaignId: CampaignId): Int

    /**
     * Returns the number of remaining (undrawn) tickets for a campaign.
     *
     * Counts draw tickets whose `drawn_by_player_id` is null across all boxes of
     * the campaign. This is a read-through aggregation; the result is not cached.
     *
     * @param campaignId The campaign's unique identifier.
     * @return Number of available draw tickets.
     */
    public suspend fun countRemainingTickets(campaignId: CampaignId): Int

    /**
     * Records that a low-stock push notification has been sent for a campaign.
     *
     * Sets `low_stock_notified_at` to the current UTC timestamp so the notification
     * worker does not re-send for the same campaign.
     *
     * @param campaignId The campaign to mark.
     */
    public suspend fun markLowStockNotified(campaignId: CampaignId)
}
