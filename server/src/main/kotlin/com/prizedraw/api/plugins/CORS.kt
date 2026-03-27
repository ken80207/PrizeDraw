package com.prizedraw.api.plugins

import io.ktor.http.HttpHeaders
import io.ktor.http.HttpMethod
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.cors.routing.CORS

/**
 * Installs CORS with config-driven allowed origins.
 *
 * Allowed origins are read from `cors.allowedOrigins` in `application.conf` as a list
 * of full origin URLs (e.g. `["https://play.prizedraw.app", "https://admin.prizedraw.app"]`).
 * Falls back to localhost origins for local development when the config key is absent.
 *
 * W-6 fix: replaced `anyHost()` with explicit per-origin `allowHost` entries. Using
 * `anyHost()` together with `allowCredentials = true` violates the CORS specification
 * (browsers reject `Access-Control-Allow-Origin: *` when credentials are included).
 */
public fun Application.configureCORS() {
    // W-6: read allowed origins from config; fall back to safe development defaults
    // Read from cors.allowedHosts (may be a comma-separated env var or HOCON list)
    val rawHosts = environment.config
        .propertyOrNull("cors.allowedHosts")
        ?.getString()
    val allowedOrigins = if (rawHosts != null) {
        rawHosts.split(",").map { host ->
            val h = host.trim().removeSurrounding("[", "]").removeSurrounding("\"")
            if (h.startsWith("http")) h else "http://$h"
        }
    } else {
        listOf("http://localhost:3000", "http://localhost:3001", "http://localhost:3002")
    }

    install(CORS) {
        allowedOrigins.forEach { origin ->
            val withoutScheme =
                origin
                    .removePrefix("https://")
                    .removePrefix("http://")
            val schemes =
                buildList {
                    if (origin.startsWith("https://")) {
                        add("https")
                    } else {
                        add("http")
                    }
                }
            allowHost(withoutScheme, schemes = schemes)
        }

        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.ContentType)
        allowHeader(HttpHeaders.Accept)
        allowHeader("X-Request-ID")
        allowMethod(HttpMethod.Get)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Put)
        allowMethod(HttpMethod.Patch)
        allowMethod(HttpMethod.Delete)
        allowMethod(HttpMethod.Options)
        allowCredentials = true
        @Suppress("MagicNumber")
        maxAgeInSeconds = 86_400 // 24 hours in seconds
    }
}
