package com.prizedraw.application.ports.input.admin

import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.valueobjects.StaffId

/**
 * Input port for creating a new Kuji campaign in DRAFT status.
 *
 * The campaign is created with no ticket boxes; boxes are added via subsequent operations.
 * Validates that [pricePerDraw] is positive and [drawSessionSeconds] is positive.
 */
public interface ICreateKujiCampaignUseCase {
    /**
     * Creates a [KujiCampaign] in DRAFT status.
     *
     * @param staffId The staff member creating the campaign.
     * @param title Campaign display name.
     * @param description Optional rich-text description.
     * @param coverImageUrl Optional CDN URL for cover art.
     * @param pricePerDraw Draw points cost per single draw. Must be > 0.
     * @param drawSessionSeconds Exclusive draw session duration. Must be > 0.
     * @return The persisted campaign entity.
     */
    public suspend fun execute(
        staffId: StaffId,
        title: String,
        description: String?,
        coverImageUrl: String?,
        pricePerDraw: Int,
        drawSessionSeconds: Int,
    ): KujiCampaign
}
