package com.prizedraw.domain.valueobjects

/**
 * A validated email address.
 *
 * Validation uses a pragmatic regex covering the common subset of RFC 5321/5322 addresses
 * used in practice. Full RFC compliance is intentionally not implemented to avoid complexity;
 * the application relies on verified delivery for final confirmation.
 *
 * The stored value is lowercased to normalise lookups.
 *
 * @property value The normalised (lowercase) email address string.
 * @throws IllegalArgumentException if [value] is not a recognisable email address.
 */
@JvmInline
public value class EmailAddress(
    public val value: String,
) {
    init {
        val normalised = value.trim().lowercase()
        require(EMAIL_REGEX.matches(normalised)) {
            "Invalid email address: '$value'"
        }
    }

    override fun toString(): String = value

    public companion object {
        private val EMAIL_REGEX =
            Regex(
                """^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$"""
            )

        /**
         * Creates an [EmailAddress] from [raw], normalising to lowercase.
         * Returns null if the format is invalid.
         */
        public fun tryParse(raw: String): EmailAddress? =
            runCatching { EmailAddress(raw.trim().lowercase()) }.getOrNull()
    }
}
