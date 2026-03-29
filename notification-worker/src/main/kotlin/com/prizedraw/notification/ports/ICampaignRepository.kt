package com.prizedraw.notification.ports

import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.valueobjects.CampaignId

/**
 * Output port for campaign queries used by the low-stock notification worker.
 *
 * This is a reduced interface containing only the methods required by
 * [LowStockNotificationJob]; it does not expose full campaign CRUD.
 */
public interface ICampaignRepository {
    /**
     * Returns all active [KujiCampaign]s that have not yet had a low-stock notification dispatched.
     *
     * @return Active campaigns with lowStockNotifiedAt equal to null.
     */
    public suspend fun findActiveKujiCampaignsNotLowStockNotified(): List<KujiCampaign>

    /**
     * Returns the total number of tickets across all ticket boxes for a campaign.
     *
     * @param campaignId The campaign's unique identifier.
     * @return Sum of totalTickets for all boxes belonging to this campaign.
     */
    public suspend fun countTotalTickets(campaignId: CampaignId): Int

    /**
     * Returns the number of remaining (undrawn) tickets for a campaign.
     *
     * @param campaignId The campaign's unique identifier.
     * @return Number of available draw tickets.
     */
    public suspend fun countRemainingTickets(campaignId: CampaignId): Int

    /**
     * Records that a low-stock push notification has been sent for a campaign.
     *
     * Sets lowStockNotifiedAt to the current UTC timestamp so the notification
     * worker does not re-send for the same campaign.
     *
     * @param campaignId The campaign to mark.
     */
    public suspend fun markLowStockNotified(campaignId: CampaignId)
}
