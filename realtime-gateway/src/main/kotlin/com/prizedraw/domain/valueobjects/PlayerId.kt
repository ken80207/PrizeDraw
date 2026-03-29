package com.prizedraw.domain.valueobjects

import java.util.UUID

/**
 * Strongly-typed identifier for a player.
 *
 * Using an inline value class avoids boxing overhead at runtime while
 * preventing accidental mixing of different UUID-based IDs at compile time.
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
