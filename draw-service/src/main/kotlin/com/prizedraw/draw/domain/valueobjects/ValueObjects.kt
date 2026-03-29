package com.prizedraw.draw.domain.valueobjects

import java.util.UUID

/**
 * Strongly-typed identifier for a Player (draw-service copy).
 */
@JvmInline
public value class PlayerId(
    public val value: UUID,
) {
    override fun toString(): String = value.toString()

    public companion object {
        /** Creates a new random [PlayerId]. */
        public fun generate(): PlayerId = PlayerId(UUID.randomUUID())

        /** Parses a UUID string into a [PlayerId]. */
        public fun fromString(id: String): PlayerId = PlayerId(UUID.fromString(id))
    }
}

/**
 * Strongly-typed identifier for a Kuji or Unlimited campaign (draw-service copy).
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

/**
 * Strongly-typed identifier for a PrizeDefinition (draw-service copy).
 */
@JvmInline
public value class PrizeDefinitionId(
    public val value: UUID,
) {
    override fun toString(): String = value.toString()

    public companion object {
        /** Creates a new random [PrizeDefinitionId]. */
        public fun generate(): PrizeDefinitionId = PrizeDefinitionId(UUID.randomUUID())

        /** Parses a UUID string into a [PrizeDefinitionId]. */
        public fun fromString(id: String): PrizeDefinitionId = PrizeDefinitionId(UUID.fromString(id))
    }
}

/**
 * Strongly-typed identifier for a PrizeInstance (draw-service copy).
 */
@JvmInline
public value class PrizeInstanceId(
    public val value: UUID,
) {
    override fun toString(): String = value.toString()

    public companion object {
        /** Creates a new random [PrizeInstanceId]. */
        public fun generate(): PrizeInstanceId = PrizeInstanceId(UUID.randomUUID())

        /** Parses a UUID string into a [PrizeInstanceId]. */
        public fun fromString(id: String): PrizeInstanceId = PrizeInstanceId(UUID.fromString(id))
    }
}

/**
 * Strongly-typed identifier for a CampaignGrade (draw-service copy).
 */
@JvmInline
public value class CampaignGradeId(
    public val value: UUID,
) {
    override fun toString(): String = value.toString()
}
