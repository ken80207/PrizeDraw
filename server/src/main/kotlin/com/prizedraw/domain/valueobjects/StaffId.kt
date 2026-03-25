package com.prizedraw.domain.valueobjects

import java.util.UUID

/**
 * Strongly-typed identifier for a [com.prizedraw.domain.entities.Staff] member.
 *
 * Using an inline value class avoids boxing overhead at runtime while preventing
 * accidental mixing of different UUID-based IDs at compile time.
 */
@JvmInline
public value class StaffId(
    public val value: UUID,
) {
    override fun toString(): String = value.toString()

    public companion object {
        /** Creates a new random [StaffId]. */
        public fun generate(): StaffId = StaffId(UUID.randomUUID())

        /** Parses a UUID string into a [StaffId]. */
        public fun fromString(id: String): StaffId = StaffId(UUID.fromString(id))
    }
}
