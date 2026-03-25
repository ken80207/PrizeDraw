package com.prizedraw.domain.valueobjects

/**
 * A validated E.164-format phone number.
 *
 * E.164 format requires a leading `+`, a country code (1–3 digits), and a subscriber
 * number for a total length of 8–15 digits after the `+`. Example: `+886912345678`.
 *
 * @property value The raw E.164 string. Always starts with `+`.
 * @throws IllegalArgumentException if [value] does not conform to E.164 format.
 */
@JvmInline
public value class PhoneNumber(
    public val value: String,
) {
    init {
        require(E164_REGEX.matches(value)) {
            "Phone number must be in E.164 format (e.g. +886912345678), was: '$value'"
        }
    }

    override fun toString(): String = value

    public companion object {
        /** E.164: `+` followed by 7 to 15 digits (ITU-T E.164 §2.2 maximum 15 digits total). */
        private val E164_REGEX = Regex("""^\+[1-9]\d{6,14}$""")

        /**
         * Attempts to parse [raw] as an E.164 phone number.
         * Returns null if the format is invalid rather than throwing.
         */
        public fun tryParse(raw: String): PhoneNumber? = runCatching { PhoneNumber(raw) }.getOrNull()
    }
}
