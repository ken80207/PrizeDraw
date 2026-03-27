package com.prizedraw.i18n

/**
 * Simple i18n string provider for Compose Multiplatform.
 *
 * Defaults to `zh-TW` (Traditional Chinese). Switch [currentLocale] to `"en"` to
 * serve English strings. Falls back to `zh-TW` for any key not present in the
 * target locale map, and finally returns the raw key if both maps lack it.
 *
 * Usage:
 * ```kotlin
 * // Direct object call
 * val label = Strings["nav.home"]
 *
 * // Inside a Composable
 * Text(text = S("nav.home"))
 * ```
 */
public object Strings {
    /** Active locale code. Supported values: `"zh-TW"`, `"en"`. */
    public var currentLocale: String = "zh-TW"

    /**
     * Returns the localised string for [key].
     *
     * Resolution order:
     * 1. Locale map matching [currentLocale]
     * 2. [ZH_TW] as the canonical fallback
     * 3. The raw [key] string so the UI never shows `null`
     */
    public fun get(key: String): String = when (currentLocale) {
        "en" -> EN[key] ?: ZH_TW[key] ?: key
        else -> ZH_TW[key] ?: key
    }
}

/**
 * Operator overload for bracket-style access: `Strings["nav.home"]`.
 *
 * Delegates to [Strings.get].
 */
public operator fun Strings.get(key: String): String = get(key)
