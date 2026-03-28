package com.prizedraw.i18n

import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable

/**
 * Composable-friendly string accessor.
 *
 * Delegates to [Strings.get] so locale changes made to [Strings.currentLocale] are
 * reflected on the next recomposition cycle.
 *
 * Usage:
 * ```kotlin
 * Text(text = S("nav.home"))
 * ```
 *
 * @param key Dot-separated i18n key (e.g. `"nav.home"`, `"common.loading"`).
 * @return Localised string, falling back to [ZH_TW] and then the raw key.
 */
@Composable
@ReadOnlyComposable
public fun S(key: String): String = Strings.get(key)

/**
 * String with named placeholder substitution.
 *
 * Replaces every `{name}` token in the template with the corresponding value
 * from [params].
 *
 * Usage:
 * ```kotlin
 * Text(text = S("common.minutesAgo", "count" to "5"))
 * // → "5 min ago"  (en)  /  "5 分鐘前"  (zh-TW)
 *
 * Text(text = S("campaign.ticketRemaining", "remaining" to "3", "total" to "20"))
 * ```
 *
 * @param key Dot-separated i18n key.
 * @param params Name-value pairs used to fill `{name}` placeholders in the string.
 * @return Localised string with all matching placeholders substituted.
 */
@Composable
@ReadOnlyComposable
public fun S(
    key: String,
    vararg params: Pair<String, String>,
): String {
    var result = Strings.get(key)
    params.forEach { (name, value) -> result = result.replace("{$name}", value) }
    return result
}
