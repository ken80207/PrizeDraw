package com.prizedraw.shared.validation

/**
 * Validates and formats phone numbers for the PrizeDraw platform.
 *
 * The platform stores phone numbers exclusively in E.164 format (e.g. `+886912345678`).
 * Display formatting targets the Taiwan market using the local convention `09XX-XXX-XXX`.
 */
public class PhoneValidator {
    /**
     * Returns `true` when [phone] is a valid E.164-format phone number.
     *
     * A valid E.164 number:
     * - Starts with `+`
     * - Followed by a non-zero country code digit
     * - Total length between 8 and 16 characters (including the leading `+`)
     *
     * @param phone Phone number string to validate.
     */
    public fun isValidE164(phone: String): Boolean = E164_REGEX.matches(phone)

    /**
     * Formats a Taiwan E.164 number for human-readable display.
     *
     * Strips the `+886` country prefix and reformats the remaining 9 local digits
     * as `0912-345-678`.  For non-Taiwan numbers the raw E.164 string is returned unchanged.
     *
     * @param phone E.164-format phone number (e.g. `+886912345678`).
     * @return Display string (e.g. `0912-345-678`) or the original value if not a Taiwan number.
     */
    public fun formatForDisplay(phone: String): String {
        if (!phone.startsWith(TAIWAN_PREFIX)) return phone
        val local = "0" + phone.removePrefix(TAIWAN_PREFIX) // "0912345678"
        if (local.length != 10) return phone
        return "${local.substring(0, 4)}-${local.substring(4, 7)}-${local.substring(7)}"
    }

    private companion object {
        // E.164: '+' then 1 non-zero digit then 6–14 more digits = total length 8–16
        val E164_REGEX = Regex("""^\+[1-9]\d{6,14}$""")
        const val TAIWAN_PREFIX = "+886"
    }
}
