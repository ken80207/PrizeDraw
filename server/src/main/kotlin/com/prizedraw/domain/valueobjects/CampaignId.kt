package com.prizedraw.domain.valueobjects

import java.util.UUID

/**
 * Strongly-typed identifier for a Kuji or Unlimited campaign.
 *
 * A single [CampaignId] wraps the UUID used by both [com.prizedraw.domain.entities.KujiCampaign]
 * and [com.prizedraw.domain.entities.UnlimitedCampaign], since both share the same surrogate
 * key structure. The campaign type context disambiguates which table is referenced.
 */
@JvmInline
public value class CampaignId(
    public val value: UUID,
) {
    override fun toString(): String = value.toString()

    public companion object {
        /** Creates a new random [CampaignId]. */
        public fun generate(): CampaignId = CampaignId(UUID.randomUUID())

        /** Parses a UUID string into a [CampaignId]. */
        public fun fromString(id: String): CampaignId = CampaignId(UUID.fromString(id))
    }
}
