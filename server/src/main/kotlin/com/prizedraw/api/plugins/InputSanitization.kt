package com.prizedraw.api.plugins

import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.ApplicationCall
import io.ktor.server.application.createApplicationPlugin
import io.ktor.server.application.install
import io.ktor.server.response.respond

// Compiled regex patterns for XSS detection — declared at file scope as constants.
private val javascriptUriRegex = Regex("javascript:", RegexOption.IGNORE_CASE)
private val onEventRegex = Regex("""on\w+\s*=\s*["']?[^"']*["']?""", RegexOption.IGNORE_CASE)

/**
 * Ktor plugin that guards against cross-site scripting (XSS) by sanitizing inputs.
 *
 * This plugin registers a request interceptor that:
 * 1. Rejects requests whose `Content-Type` header contains dangerous injection patterns.
 * 2. Provides utility functions ([sanitizeHtml], [sanitizedQueryParam], [sanitizedPathParam])
 *    that route handlers and DTO `init` blocks call to strip HTML/script content.
 *
 * Design note: Ktor does not expose a post-deserialization pipeline hook that gives
 * structured access to individual DTO fields. Therefore, sanitization at the field level
 * is the caller's responsibility. This plugin focuses on header validation and provides
 * the canonical sanitization utilities used throughout the codebase.
 */
public val inputSanitizationPlugin =
    createApplicationPlugin(name = "InputSanitization") {
        on(io.ktor.server.application.hooks.CallSetup) { call ->
            val method = call.request.local.method.value
            if (method == "POST" || method == "PUT" || method == "PATCH") {
                val contentType = call.request.headers["Content-Type"].orEmpty()
                if (containsDangerousPatterns(contentType)) {
                    call.respond(HttpStatusCode.UnsupportedMediaType)
                }
            }
        }
    }

/**
 * Installs [inputSanitizationPlugin] on the application.
 */
public fun Application.configureInputSanitization() {
    install(inputSanitizationPlugin)
}

/**
 * Sanitizes a raw string by escaping HTML-special characters and removing XSS vectors.
 *
 * Steps applied:
 * 1. Trim whitespace.
 * 2. Escape `&`, `<`, `>`, `"`, `'`, `/`.
 * 3. Remove `javascript:` URI schemes.
 * 4. Remove inline `on*=` event handler patterns.
 *
 * For admin-authored rich text content, use OWASP Java HTML Sanitizer rather than
 * this lightweight utility.
 *
 * @param input Raw input string, possibly `null`.
 * @return Sanitized string, or `null` if [input] is `null`.
 */
public fun sanitizeHtml(input: String?): String? {
    if (input == null) {
        return null
    }
    return input
        .trim()
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
        .replace("'", "&#x27;")
        .replace("/", "&#x2F;")
        .replace(javascriptUriRegex, "")
        .replace(onEventRegex, "")
}

/**
 * Returns the sanitized value of query parameter [name], or `null` if absent.
 */
public fun ApplicationCall.sanitizedQueryParam(name: String): String? =
    request.queryParameters[name]?.let { sanitizeHtml(it) }

/**
 * Returns the sanitized value of path parameter [name].
 *
 * @throws IllegalArgumentException if the parameter is absent.
 */
public fun ApplicationCall.sanitizedPathParam(name: String): String =
    parameters[name]?.let { sanitizeHtml(it) }
        ?: throw IllegalArgumentException("Missing required path parameter: $name")

private fun containsDangerousPatterns(value: String): Boolean {
    val lower = value.lowercase()
    return lower.contains("<script") || lower.contains("javascript:")
}
