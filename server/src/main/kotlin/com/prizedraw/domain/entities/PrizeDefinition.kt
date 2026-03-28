package com.prizedraw.domain.entities

import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import kotlinx.datetime.Instant

/**
 * A prize template shared by multiple tickets (kuji) or referenced probabilistically (unlimited).
 *
 * Stores the grade, display name, images, buyback price, and — depending on campaign type —
 * either the count of tickets assigned to this definition (kuji) or the draw probability
 * in basis points (unlimited).
 *
 * Exactly one of [kujiCampaignId] and [unlimitedCampaignId] must be non-null.
 *
 * @property id Surrogate primary key.
 * @property kujiCampaignId FK to a [KujiCampaign]. Non-null only for kuji prize definitions.
 * @property unlimitedCampaignId FK to an [UnlimitedCampaign]. Non-null only for unlimited definitions.
 * @property grade Prize grade label, e.g. `A賞`, `B賞`, `Last賞`.
 * @property name Product or prize display name.
 * @property photos Ordered list of CDN URLs for prize images. At least one required before activation.
 * @property buybackPrice Official buyback amount in revenue points. 0 means buyback disabled.
 * @property buybackEnabled When false, players cannot request buyback for this prize grade.
 * @property probabilityBps Draw probability in basis points of 0.0001%. Null for kuji prizes.
 * @property ticketCount Number of tickets in the box assigned to this definition. Null for unlimited prizes.
 * @property displayOrder Rendering order within the campaign's prize list.
 * @property isRare Whether this prize triggers follower notifications when drawn.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class PrizeDefinition(
    val id: PrizeDefinitionId,
    val kujiCampaignId: CampaignId?,
    val unlimitedCampaignId: CampaignId?,
    val grade: String,
    val name: String,
    val photos: List<String>,
    val prizeValue: Int,
    val buybackPrice: Int,
    val buybackEnabled: Boolean,
    val probabilityBps: Int?,
    val ticketCount: Int?,
    val displayOrder: Int,
    /** Whether this prize triggers follower notifications when drawn. */
    val isRare: Boolean = false,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    init {
        require((kujiCampaignId == null) != (unlimitedCampaignId == null)) {
            "Exactly one of kujiCampaignId or unlimitedCampaignId must be non-null"
        }
    }

    /** Returns true if this definition belongs to a [KujiCampaign]. */
    public fun isKuji(): Boolean = kujiCampaignId != null

    /** Returns true if this definition belongs to an [UnlimitedCampaign]. */
    public fun isUnlimited(): Boolean = unlimitedCampaignId != null
}
