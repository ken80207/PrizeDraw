package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.output.IPlayerDeviceRepository
import com.prizedraw.contracts.endpoints.DeviceEndpoints
import com.prizedraw.domain.entities.DevicePlatform
import com.prizedraw.domain.entities.PlayerDevice
import io.ktor.http.HttpStatusCode
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import kotlinx.serialization.Serializable
import org.koin.ktor.ext.inject

@Serializable
private data class RegisterDeviceRequest(
    val fcmToken: String,
    val deviceName: String? = null,
    val platform: String,
)

/**
 * Registers device token management routes.
 *
 * Protected endpoints (JWT required):
 * - POST [DeviceEndpoints.REGISTER]   — Register or refresh an FCM device token
 * - POST [DeviceEndpoints.UNREGISTER] — Remove an FCM device token
 */
public fun Route.deviceRoutes() {
    val deviceRepository: IPlayerDeviceRepository by inject()

    authenticate("player") {
        post(DeviceEndpoints.REGISTER) {
            val principal = call.principal<PlayerPrincipal>()!!
            val request = call.receive<RegisterDeviceRequest>()
            val platform =
                try {
                    DevicePlatform.valueOf(request.platform.uppercase())
                } catch (_: IllegalArgumentException) {
                    call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid platform"))
                    return@post
                }
            deviceRepository.upsert(
                PlayerDevice(
                    playerId = principal.playerId.value,
                    fcmToken = request.fcmToken,
                    deviceName = request.deviceName,
                    platform = platform,
                ),
            )
            call.respond(HttpStatusCode.Created, mapOf("status" to "registered"))
        }

        post(DeviceEndpoints.UNREGISTER) {
            @Serializable
            data class UnregisterRequest(
                val fcmToken: String,
            )

            val request = call.receive<UnregisterRequest>()
            deviceRepository.deleteByToken(request.fcmToken)
            call.respond(HttpStatusCode.OK, mapOf("status" to "unregistered"))
        }
    }
}
