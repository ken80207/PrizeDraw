package com.prizedraw.api.routes

import com.prizedraw.api.plugins.StaffPrincipal
import com.prizedraw.api.plugins.satisfies
import com.prizedraw.application.ports.input.admin.IManageAnimationModesUseCase
import com.prizedraw.contracts.endpoints.AdminEndpoints
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.StaffRole
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import kotlinx.serialization.Serializable
import org.koin.ktor.ext.inject

/**
 * Admin routes for managing draw animation modes.
 *
 * Requires `authenticate("staff")` in the parent scope and [StaffRole.ADMIN] or above.
 *
 * - GET  [AdminEndpoints.ANIMATION_MODES]         — List all animation modes and their enabled state
 * - PATCH [AdminEndpoints.ANIMATION_MODE_BY_KEY]  — Enable or disable a single animation mode
 */
public fun Route.adminAnimationRoutes() {
    val manageAnimationModesUseCase: IManageAnimationModesUseCase by inject()

    get(AdminEndpoints.ANIMATION_MODES) {
        call.requireAdmin() ?: return@get
        val states = manageAnimationModesUseCase.getAllModeStates()
        call.respond(
            HttpStatusCode.OK,
            states.map { (mode, enabled) ->
                mapOf("mode" to mode.name, "enabled" to enabled)
            }
        )
    }

    patch(AdminEndpoints.ANIMATION_MODE_BY_KEY) {
        val staff = call.requireAdmin() ?: return@patch
        val modeKey =
            call.parameters["modeKey"] ?: run {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing modeKey"))
                return@patch
            }
        val mode =
            runCatching { DrawAnimationMode.valueOf(modeKey.uppercase()) }.getOrElse {
                call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid animation mode: $modeKey"))
                return@patch
            }

        @Serializable
        data class ToggleRequest(
            val enabled: Boolean,
        )
        val request = call.receive<ToggleRequest>()
        val states = manageAnimationModesUseCase.setModeEnabled(staff.staffId, mode, request.enabled)
        call.respond(
            HttpStatusCode.OK,
            states.map { (m, enabled) ->
                mapOf("mode" to m.name, "enabled" to enabled)
            }
        )
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.requireAdmin(): StaffPrincipal? {
    val staff = principal<StaffPrincipal>()
    if (staff == null) {
        respond(HttpStatusCode.Unauthorized, mapOf("error" to "Authentication required"))
        return null
    }
    if (!staff.role.satisfies(StaffRole.ADMIN)) {
        respond(HttpStatusCode.Forbidden, mapOf("error" to "Requires ADMIN role or above"))
        return null
    }
    return staff
}
