package com.prizedraw.domain.valueobjects

import java.util.UUID

/**
 * Strongly-typed identifier for a [com.prizedraw.domain.entities.PrizeDefinition].
 *
 * PrizeDefinitions are the templates from which PrizeInstances are created.
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
 * Strongly-typed identifier for a [com.prizedraw.domain.entities.PrizeInstance].
 *
 * PrizeInstances are concrete prizes owned by a player, derived from a [PrizeDefinitionId].
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
