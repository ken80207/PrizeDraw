package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.application.ports.input.admin.AnnouncementNotFoundException
import com.prizedraw.application.ports.input.admin.CreateAnnouncementCommand
import com.prizedraw.application.ports.input.admin.ICreateAnnouncementUseCase
import com.prizedraw.application.ports.input.admin.IDeactivateAnnouncementUseCase
import com.prizedraw.application.ports.input.admin.IUpdateAnnouncementUseCase
import com.prizedraw.application.ports.output.IServerAnnouncementRepository
import com.prizedraw.contracts.dto.status.AnnouncementDto
import com.prizedraw.contracts.dto.status.AnnouncementType
import com.prizedraw.contracts.dto.status.CreateAnnouncementRequest
import com.prizedraw.contracts.dto.status.UpdateAnnouncementRequest
import com.prizedraw.contracts.endpoints.StatusEndpoints
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.entities.AnnouncementEntityType
import com.prizedraw.domain.entities.ServerAnnouncement
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import java.util.UUID

/**
 * Registers admin announcement management routes.
 *
 * All routes require `authenticate("staff")` in the parent scope (enforced in Routing.kt)
 * and [StaffRole.OPERATOR] or above (enforced per handler).
 *
 * - GET [StatusEndpoints.ADMIN_ANNOUNCEMENTS]        — list all announcements
 * - POST   [StatusEndpoints.ADMIN_ANNOUNCEMENTS]        — create new announcement
 * - PATCH  [StatusEndpoints.ADMIN_ANNOUNCEMENT_BY_ID]   — partial update
 * - DELETE [StatusEndpoints.ADMIN_ANNOUNCEMENT_BY_ID]   — deactivate
 */
public fun Route.adminAnnouncementRoutes() {
    listAnnouncementsRoute()
    createAnnouncementRoute()
    updateAnnouncementRoute()
    deactivateAnnouncementRoute()
}

private fun Route.listAnnouncementsRoute() {
    val announcementRepository: IServerAnnouncementRepository by inject()
    get(StatusEndpoints.ADMIN_ANNOUNCEMENTS) {
        call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@get
        val announcements = announcementRepository.findAll()
        call.respond(HttpStatusCode.OK, announcements.map { it.toDto() })
    }
}

private fun Route.createAnnouncementRoute() {
    val createAnnouncement: ICreateAnnouncementUseCase by inject()
    post(StatusEndpoints.ADMIN_ANNOUNCEMENTS) {
        val actor = call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@post
        val request = call.receive<CreateAnnouncementRequest>()
        runCatching {
            createAnnouncement.execute(
                CreateAnnouncementCommand(
                    actorStaffId = actor.staffId,
                    type = request.type.toEntityType(),
                    title = request.title,
                    message = request.message,
                    isBlocking = request.isBlocking,
                    targetPlatforms = request.targetPlatforms,
                    minAppVersion = request.minAppVersion,
                    scheduledStart = request.scheduledStart,
                    scheduledEnd = request.scheduledEnd,
                ),
            )
        }.fold(
            onSuccess = { call.respond(HttpStatusCode.Created, it.toDto()) },
            onFailure = { e ->
                call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to (e.message ?: "Failed to create announcement")),
                )
            },
        )
    }
}

private fun Route.updateAnnouncementRoute() {
    val updateAnnouncement: IUpdateAnnouncementUseCase by inject()
    patch(StatusEndpoints.ADMIN_ANNOUNCEMENT_BY_ID) {
        val actor = call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@patch
        val id =
            call.parameters["id"]
                ?.let { runCatching { UUID.fromString(it) }.getOrNull() }
                ?: return@patch call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to "Invalid announcement ID"),
                )

        val request = call.receive<UpdateAnnouncementRequest>()
        runCatching {
            updateAnnouncement.execute(
                actorStaffId = actor.staffId,
                id = id,
                title = request.title,
                message = request.message,
                isBlocking = request.isBlocking,
                isActive = request.isActive,
                scheduledEnd = request.scheduledEnd,
            )
        }.fold(
            onSuccess = { call.respond(HttpStatusCode.OK, it.toDto()) },
            onFailure = { e ->
                when (e) {
                    is AnnouncementNotFoundException ->
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to "Announcement not found"))
                    else ->
                        call.respond(
                            HttpStatusCode.BadRequest,
                            mapOf("error" to (e.message ?: "Failed to update announcement")),
                        )
                }
            },
        )
    }
}

private fun Route.deactivateAnnouncementRoute() {
    val deactivateAnnouncement: IDeactivateAnnouncementUseCase by inject()
    delete(StatusEndpoints.ADMIN_ANNOUNCEMENT_BY_ID) {
        val actor = call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@delete
        val id =
            call.parameters["id"]
                ?.let { runCatching { UUID.fromString(it) }.getOrNull() }
                ?: return@delete call.respond(
                    HttpStatusCode.BadRequest,
                    mapOf("error" to "Invalid announcement ID"),
                )

        runCatching {
            deactivateAnnouncement.execute(
                actorStaffId = actor.staffId,
                id = id,
            )
        }.fold(
            onSuccess = { call.respond(HttpStatusCode.NoContent) },
            onFailure = { e ->
                when (e) {
                    is AnnouncementNotFoundException ->
                        call.respond(HttpStatusCode.NotFound, mapOf("error" to "Announcement not found"))
                    else ->
                        call.respond(
                            HttpStatusCode.InternalServerError,
                            mapOf("error" to (e.message ?: "Failed to deactivate announcement")),
                        )
                }
            },
        )
    }
}

private fun ServerAnnouncement.toDto(): AnnouncementDto =
    AnnouncementDto(
        id = id.toString(),
        type = type.toContractType(),
        title = title,
        message = message,
        isBlocking = isBlocking,
        scheduledStart = scheduledStart,
        scheduledEnd = scheduledEnd,
    )

private fun AnnouncementEntityType.toContractType(): AnnouncementType =
    when (this) {
        AnnouncementEntityType.MAINTENANCE -> AnnouncementType.MAINTENANCE
        AnnouncementEntityType.ANNOUNCEMENT -> AnnouncementType.ANNOUNCEMENT
        AnnouncementEntityType.UPDATE_REQUIRED -> AnnouncementType.UPDATE_REQUIRED
    }

private fun AnnouncementType.toEntityType(): AnnouncementEntityType =
    when (this) {
        AnnouncementType.MAINTENANCE -> AnnouncementEntityType.MAINTENANCE
        AnnouncementType.ANNOUNCEMENT -> AnnouncementEntityType.ANNOUNCEMENT
        AnnouncementType.UPDATE_REQUIRED -> AnnouncementEntityType.UPDATE_REQUIRED
    }
