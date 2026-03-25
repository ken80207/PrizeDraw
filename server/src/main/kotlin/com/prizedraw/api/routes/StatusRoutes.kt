package com.prizedraw.api.routes

import com.prizedraw.application.ports.output.IServerAnnouncementRepository
import com.prizedraw.contracts.dto.status.AnnouncementDto
import com.prizedraw.contracts.dto.status.AnnouncementType
import com.prizedraw.contracts.dto.status.MinAppVersion
import com.prizedraw.contracts.dto.status.ServerStatus
import com.prizedraw.contracts.dto.status.ServerStatusResponse
import com.prizedraw.contracts.endpoints.StatusEndpoints
import com.prizedraw.domain.entities.AnnouncementEntityType
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.datetime.Clock
import org.koin.ktor.ext.inject

/**
 * Registers the public server status endpoint.
 *
 * [GET /api/v1/status] — No authentication required. This is the **first** endpoint
 * all clients (web, mobile, admin, CS) call on startup and poll periodically.
 *
 * Response semantics:
 * - [ServerStatus.MAINTENANCE] is returned when at least one active announcement
 *   has `isBlocking = true`. Clients must render a full-screen blocking overlay.
 * - [ServerStatus.ONLINE] is returned otherwise.
 * - The `minAppVersion` field is populated from the first active UPDATE_REQUIRED
 *   announcement that carries a `minAppVersion` value.
 */
public fun Route.statusRoutes() {
    val announcementRepository: IServerAnnouncementRepository by inject()

    get(StatusEndpoints.STATUS) {
        val activeAnnouncements = announcementRepository.findAllActive()

        val isBlocked = activeAnnouncements.any { it.isBlocking }
        val overallStatus =
            if (isBlocked) {
                ServerStatus.MAINTENANCE
            } else {
                ServerStatus.ONLINE
            }

        // Derive minAppVersion from any active UPDATE_REQUIRED announcement
        val updateAnnouncement =
            activeAnnouncements
                .firstOrNull { it.type == AnnouncementEntityType.UPDATE_REQUIRED && it.minAppVersion != null }
        val minAppVersion =
            if (updateAnnouncement?.minAppVersion != null) {
                MinAppVersion(android = updateAnnouncement.minAppVersion, ios = updateAnnouncement.minAppVersion)
            } else {
                null
            }

        val announcementDtos = activeAnnouncements.map { announcement ->
            AnnouncementDto(
                id = announcement.id.toString(),
                type = announcement.type.toContractType(),
                title = announcement.title,
                message = announcement.message,
                isBlocking = announcement.isBlocking,
                scheduledStart = announcement.scheduledStart,
                scheduledEnd = announcement.scheduledEnd,
            )
        }

        call.respond(
            ServerStatusResponse(
                status = overallStatus,
                serverTime = Clock.System.now(),
                announcements = announcementDtos,
                minAppVersion = minAppVersion,
            ),
        )
    }
}

private fun AnnouncementEntityType.toContractType(): AnnouncementType =
    when (this) {
        AnnouncementEntityType.MAINTENANCE -> AnnouncementType.MAINTENANCE
        AnnouncementEntityType.ANNOUNCEMENT -> AnnouncementType.ANNOUNCEMENT
        AnnouncementEntityType.UPDATE_REQUIRED -> AnnouncementType.UPDATE_REQUIRED
    }
