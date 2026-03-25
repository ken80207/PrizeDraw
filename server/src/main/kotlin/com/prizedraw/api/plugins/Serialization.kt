package com.prizedraw.api.plugins

import io.ktor.serialization.kotlinx.json.json
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.contentnegotiation.ContentNegotiation
import kotlinx.serialization.json.Json

/**
 * Installs [ContentNegotiation] with kotlinx.serialization JSON.
 *
 * The JSON instance is lenient enough to handle unknown keys gracefully
 * (forward-compatibility with new API contract fields).
 */
public fun Application.configureSerialization() {
    install(ContentNegotiation) {
        json(
            Json {
                ignoreUnknownKeys = true
                isLenient = false
                encodeDefaults = true
                prettyPrint = false
                explicitNulls = false
            },
        )
    }
}
