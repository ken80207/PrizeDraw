package com.prizedraw.application.ports.input.admin

import com.prizedraw.domain.entities.UnlimitedCampaign
import com.prizedraw.domain.valueobjects.StaffId

/**
 * Input port for creating a new Unlimited campaign in DRAFT status.
 *
 * Validates that [pricePerDraw] is positive and [rateLimitPerSecond] is >= 1.
 */
public interface ICreateUnlimitedCampaignUseCase {
    /**
     * Creates an [UnlimitedCampaign] in DRAFT status.
     *
     * @param staffId The staff member creating the campaign.
     * @param title Campaign display name.
     * @param description Optional rich-text description.
     * @param coverImageUrl Optional CDN URL for cover art.
     * @param pricePerDraw Draw points cost per single draw. Must be > 0.
     * @param rateLimitPerSecond Maximum draws per second per player. Must be >= 1.
     * @return The persisted campaign entity.
     */
    public suspend fun execute(
        staffId: StaffId,
        title: String,
        description: String?,
        coverImageUrl: String?,
        pricePerDraw: Int,
        rateLimitPerSecond: Int,
    ): UnlimitedCampaign
}
