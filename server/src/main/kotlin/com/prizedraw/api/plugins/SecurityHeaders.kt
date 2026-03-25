package com.prizedraw.api.plugins

import io.ktor.http.CacheControl
import io.ktor.http.ContentType
import io.ktor.http.HttpHeaders
import io.ktor.http.content.CachingOptions
import io.ktor.server.application.Application
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.install
import io.ktor.server.plugins.cachingheaders.CachingHeaders
import io.ktor.server.plugins.compression.Compression
import io.ktor.server.plugins.compression.deflate
import io.ktor.server.plugins.compression.gzip
import io.ktor.server.plugins.compression.minimumSize

/**
 * Minimum response size (in bytes) before compression is applied.
 *
 * 1 KB threshold avoids compressing tiny JSON responses where overhead exceeds savings.
 */
private const val MIN_RESPONSE_SIZE_BYTES = 1024L

/** Max-age in seconds for non-JSON text responses from the API server. */
private const val API_TEXT_CACHE_MAX_AGE_SECONDS = 60

/** HSTS max-age: 1 year in seconds. */
private const val HSTS_MAX_AGE_SECONDS = 31_536_000

/** Gzip compression priority (preferred over Deflate). */
private const val GZIP_PRIORITY = 1.0

/** Deflate compression priority (secondary encoding). */
private const val DEFLATE_PRIORITY = 0.9

/**
 * Ktor plugin that appends standard HTTP security headers to every response.
 *
 * Headers applied:
 * - `X-Content-Type-Options: nosniff` — prevents MIME-type sniffing attacks.
 * - `X-Frame-Options: DENY` — blocks clickjacking via `<iframe>` embedding.
 * - `Strict-Transport-Security` — enforces HTTPS for 1 year including subdomains.
 * - `X-XSS-Protection: 0` — disables the legacy browser XSS filter (replaced by CSP).
 * - `Referrer-Policy: strict-origin-when-cross-origin` — minimises referrer leakage.
 * - `Permissions-Policy` — disables unused browser hardware APIs.
 * - `Content-Security-Policy` — API-layer CSP (no scripts, no embeds).
 * - `Server: PrizeDraw` — replaces Netty's default `Server` header to reduce fingerprinting.
 *
 * The full page-level CSP for web and admin frontends is in Next.js `next.config.js`.
 * This plugin covers only the Ktor API server.
 */
public val securityHeadersPlugin =
    createApplicationPlugin(name = "SecurityHeaders") {
        onCall { call ->
            call.response.headers.apply {
                append("X-Content-Type-Options", "nosniff", safeOnly = false)
                append("X-Frame-Options", "DENY", safeOnly = false)
                append(
                    "Strict-Transport-Security",
                    "max-age=$HSTS_MAX_AGE_SECONDS; includeSubDomains; preload",
                    safeOnly = false,
                )
                append("X-XSS-Protection", "0", safeOnly = false)
                append(
                    "Referrer-Policy",
                    "strict-origin-when-cross-origin",
                    safeOnly = false,
                )
                append(
                    "Permissions-Policy",
                    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
                    safeOnly = false,
                )
                append(
                    "Content-Security-Policy",
                    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
                    safeOnly = false,
                )
                append(HttpHeaders.Server, "PrizeDraw", safeOnly = false)
            }
        }
    }

/**
 * Installs the [securityHeadersPlugin] on the application.
 */
public fun Application.configureSecurityHeaders() {
    install(securityHeadersPlugin)
}

/**
 * Installs Ktor response compression.
 *
 * Gzip (priority 1.0) and Deflate (priority 0.9) are both registered.
 * Compression is only applied to responses larger than [MIN_RESPONSE_SIZE_BYTES].
 */
public fun Application.configureCompression() {
    install(Compression) {
        gzip {
            priority = GZIP_PRIORITY
            minimumSize(MIN_RESPONSE_SIZE_BYTES)
        }
        deflate {
            priority = DEFLATE_PRIORITY
            minimumSize(MIN_RESPONSE_SIZE_BYTES)
        }
    }
}

/**
 * Installs cache-control headers for API responses.
 *
 * - `application/json`: `no-store` — never cache API responses in browsers or proxies.
 * - `text/html`, `text/plain`: short private cache ([API_TEXT_CACHE_MAX_AGE_SECONDS] seconds).
 * - All other content types: Ktor's default (no explicit directive).
 */
public fun Application.configureCachingHeaders() {
    install(CachingHeaders) {
        options { _, outgoingContent ->
            when (outgoingContent.contentType?.withoutParameters()) {
                ContentType.Application.Json ->
                    CachingOptions(CacheControl.NoStore(visibility = null))
                ContentType.Text.Html, ContentType.Text.Plain ->
                    CachingOptions(
                        CacheControl.MaxAge(
                            maxAgeSeconds = API_TEXT_CACHE_MAX_AGE_SECONDS,
                            visibility = CacheControl.Visibility.Private,
                        ),
                    )
                else -> null
            }
        }
    }
}
