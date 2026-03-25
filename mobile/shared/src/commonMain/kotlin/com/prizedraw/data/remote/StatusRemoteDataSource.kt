package com.prizedraw.data.remote

import com.prizedraw.contracts.dto.status.ServerStatusResponse
import com.prizedraw.contracts.endpoints.StatusEndpoints
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get

/**
 * Remote data source for the public server status endpoint.
 *
 * The `/api/v1/status` call requires no authentication and is the first network
 * call the app makes on startup. All subsequent navigation decisions (maintenance
 * screen, update prompt, or normal flow) are based on the response.
 *
 * Polling cadence: called once at startup then every 30 seconds while a maintenance
 * screen is active, and every 60 seconds during normal operation.
 *
 * @param httpClient The shared Ktor [HttpClient] instance (injected via Koin/DI).
 */
public class StatusRemoteDataSource(
    private val httpClient: HttpClient,
) {
    /**
     * Fetches the current server status and active announcements.
     *
     * @return [ServerStatusResponse] with overall status, announcement list, and
     *   minimum required app versions.
     * @throws io.ktor.client.plugins.ClientRequestException on 4xx responses.
     * @throws io.ktor.client.plugins.ServerResponseException on 5xx responses.
     */
    public suspend fun fetchServerStatus(): ServerStatusResponse =
        httpClient.get(StatusEndpoints.STATUS).body()
}
