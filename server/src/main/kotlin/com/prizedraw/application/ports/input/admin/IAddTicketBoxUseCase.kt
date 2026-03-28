package com.prizedraw.application.ports.input.admin

import com.prizedraw.contracts.dto.admin.CreateKujiBoxRequest
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.StaffId

/**
 * Input port for adding new ticket boxes to an existing KUJI campaign (restock).
 *
 * When the campaign is [CampaignStatus.SOLD_OUT], restocking transitions it back to ACTIVE
 * and notifies all players who favorited the campaign.
 */
public interface IAddTicketBoxUseCase {
    /**
     * Adds one or more ticket boxes to an existing KUJI campaign.
     *
     * @param staffId The staff member performing the restock.
     * @param campaignId The target KUJI campaign.
     * @param boxes The new ticket boxes to add.
     * @return The list of created [TicketBox] entities.
     * @throws IllegalArgumentException if campaign is not KUJI or status is invalid.
     */
    public suspend fun execute(
        staffId: StaffId,
        campaignId: CampaignId,
        boxes: List<CreateKujiBoxRequest>,
    ): List<TicketBox>
}
