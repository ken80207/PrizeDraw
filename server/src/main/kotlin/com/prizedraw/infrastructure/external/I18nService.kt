package com.prizedraw.infrastructure.external

import org.slf4j.LoggerFactory
import java.text.MessageFormat
import java.util.Locale
import java.util.ResourceBundle
import java.util.concurrent.ConcurrentHashMap

/**
 * Server-side internationalisation service.
 *
 * Loads [ResourceBundle] instances from `i18n/messages_*.properties` files on the
 * classpath. Bundles are cached after the first load keyed by locale language tag.
 *
 * Supported locales:
 * - `zh-TW` (Traditional Chinese) — default and primary locale for the platform
 * - `en` (English) — fallback when a key is absent or the locale is unrecognised
 *
 * Usage:
 * ```kotlin
 * val service = I18nService()
 * val msg = service.message("auth.otp_sent", locale = "zh-TW", "+886912345678")
 * ```
 */
public class I18nService {
    private val log = LoggerFactory.getLogger(I18nService::class.java)
    private val bundleCache = ConcurrentHashMap<String, ResourceBundle>()

    /** Default locale used when the player has not set a preference. */
    public val defaultLocale: String = "zh_TW"

    /**
     * Resolves a localised message string for the given [key].
     *
     * Falls back to the English bundle if the key is missing in the requested locale.
     * Returns the key itself if not found in any bundle (fail-safe).
     *
     * @param key     The message key, e.g. `"auth.otp_sent"`.
     * @param locale  BCP 47 language tag or `null` to use [defaultLocale].
     * @param args    Positional arguments substituted into the pattern via [MessageFormat].
     * @return The resolved and formatted message string.
     */
    public fun message(
        key: String,
        locale: String? = null,
        vararg args: Any,
    ): String {
        val resolvedLocale = locale ?: defaultLocale
        val bundle = getBundleForLocale(resolvedLocale)

        val pattern =
            runCatching { bundle.getString(key) }
                .getOrElse {
                    // Fallback to English bundle
                    val fallback = getBundleForLocale("en")
                    runCatching { fallback.getString(key) }
                        .getOrElse {
                            log.warn("i18n key not found: '{}' for locale '{}'", key, resolvedLocale)
                            return key
                        }
                }

        return if (args.isEmpty()) {
            pattern
        } else {
            runCatching { MessageFormat.format(pattern, *args) }
                .getOrElse {
                    log.warn("Failed to format i18n message for key '{}': {}", key, it.message)
                    pattern
                }
        }
    }

    /**
     * Convenience method that formats a push notification payload.
     *
     * @param titleKey  The key for the notification title.
     * @param bodyKey   The key for the notification body.
     * @param locale    Player locale string.
     * @param args      Positional arguments applied to both title and body patterns.
     * @return A [Pair] of (title, body) strings.
     */
    public fun pushNotification(
        titleKey: String,
        bodyKey: String,
        locale: String?,
        vararg args: Any,
    ): Pair<String, String> = message(titleKey, locale, *args) to message(bodyKey, locale, *args)

    private fun getBundleForLocale(locale: String): ResourceBundle =
        bundleCache.getOrPut(locale) {
            val jvmLocale = parseLocale(locale)
            runCatching {
                ResourceBundle.getBundle("i18n/messages", jvmLocale)
            }.getOrElse {
                log.warn("ResourceBundle not found for locale '{}', using root bundle", locale)
                runCatching {
                    ResourceBundle.getBundle("i18n/messages", Locale.ROOT)
                }.getOrElse { ResourceBundle.getBundle("i18n/messages") }
            }
        }

    @Suppress("DEPRECATION")
    private fun parseLocale(locale: String): Locale =
        runCatching {
            when {
                locale.contains('-') -> {
                    val parts = locale.split('-')
                    if (parts.size >= 2) {
                        Locale(parts[0], parts[1])
                    } else {
                        Locale(parts[0])
                    }
                }
                locale.contains('_') -> {
                    val parts = locale.split('_')
                    if (parts.size >= 2) {
                        Locale(parts[0], parts[1])
                    } else {
                        Locale(parts[0])
                    }
                }
                else -> Locale(locale)
            }
        }.getOrElse { Locale.ROOT }
}
