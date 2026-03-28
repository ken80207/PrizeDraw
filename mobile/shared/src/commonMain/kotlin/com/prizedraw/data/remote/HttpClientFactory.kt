package com.prizedraw.data.remote

import io.ktor.client.HttpClient
import io.ktor.client.plugins.contentnegotiation.ContentNegotiation
import io.ktor.client.plugins.defaultRequest
import io.ktor.serialization.kotlinx.json.json
import kotlinx.serialization.json.Json

/**
 * Temporary factory that creates a pre-configured [HttpClient].
 *
 * Installs JSON content negotiation and sets a default base URL. This factory is a
 * stop-gap until proper Koin DI is wired in the mobile app (TODO T107).
 *
 * TODO(T107): Move base URL to BuildConfig / platform-specific config and replace this
 *   factory with a Koin module providing a single shared [HttpClient].
 */
public object HttpClientFactory {
    // 10.0.2.2 is Android emulator's alias for host localhost.
    // For iOS simulator, use "localhost" instead.
    private const val DEFAULT_BASE_URL = "http://10.0.2.2:9092"

    /**
     * Creates a new [HttpClient] configured with JSON serialization.
     *
     * @param baseUrl Base URL to prepend to all relative request URLs.
     */
    public fun create(baseUrl: String = DEFAULT_BASE_URL): HttpClient =
        HttpClient {
            install(ContentNegotiation) {
                json(
                    Json {
                        ignoreUnknownKeys = true
                        isLenient = true
                    },
                )
            }
            defaultRequest {
                url(baseUrl)
            }
        }
}
