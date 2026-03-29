package com.prizedraw.domain.valueobjects

import java.util.UUID

/**
 * Strongly-typed identifier for a campaign grade definition.
 */
@JvmInline
public value class CampaignGradeId(
    public val value: UUID,
) {
    override fun toString(): String = value.toString()

    public companion object {
        /** Creates a new random [CampaignGradeId]. */
        public fun generate(): CampaignGradeId = CampaignGradeId(UUID.randomUUID())

        /** Parses a UUID string into a [CampaignGradeId]. */
        public fun fromString(id: String): CampaignGradeId = CampaignGradeId(UUID.fromString(id))
    }
}
