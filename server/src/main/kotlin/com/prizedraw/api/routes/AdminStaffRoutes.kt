@file:Suppress("MagicNumber")

package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.application.ports.input.admin.AuditLogFilters
import com.prizedraw.application.ports.input.admin.ICreateStaffUseCase
import com.prizedraw.application.ports.input.admin.IDeactivateStaffUseCase
import com.prizedraw.application.ports.input.admin.IGetAuditLogUseCase
import com.prizedraw.application.ports.input.admin.IUpdateStaffRoleUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IStaffRepository
import com.prizedraw.application.usecases.admin.CannotDeactivateSelfException
import com.prizedraw.application.usecases.admin.InsufficientRoleForAssignmentException
import com.prizedraw.application.usecases.admin.StaffEmailAlreadyExistsException
import com.prizedraw.application.usecases.admin.StaffNotFoundException
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.Staff
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.StaffId
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.request.receiveText
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.delete
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import io.ktor.server.routing.post
import io.ktor.server.routing.route
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.util.UUID

@Serializable
private data class CreateStaffRequest(
    val email: String,
    val name: String,
    val role: String,
    val password: String,
)

@Serializable
private data class UpdateStaffRoleRequest(
    val role: String,
)

private val staffJson =
    Json {
        isLenient = true
        ignoreUnknownKeys = true
    }

/**
 * Registers admin staff management and audit log viewer routes.
 *
 * All routes require `authenticate("staff")` in the parent scope.
 *
 * Staff CRUD (requires ADMIN or above):
 * - GET    /api/v1/admin/staff              — list all staff
 * - POST   /api/v1/admin/staff              — create new staff member
 * - PATCH  /api/v1/admin/staff/{id}/role    — update role
 * - DELETE /api/v1/admin/staff/{id}         — deactivate staff member
 *
 * Audit log (requires ADMIN or above):
 * - GET    /api/v1/admin/audit-logs         — paginated audit log with filters
 *
 * Player activity (requires ADMIN or above):
 * - GET    /api/v1/admin/players/{id}/activity — player's audit trail
 */
public fun Route.adminStaffRoutes() {
    staffManagementRoutes()
    auditLogRoutes()
}

private fun Route.staffManagementRoutes() {
    val createStaff: ICreateStaffUseCase by inject()
    val updateRole: IUpdateStaffRoleUseCase by inject()
    val deactivate: IDeactivateStaffUseCase by inject()
    val staffRepository: IStaffRepository by inject()

    route("/api/v1/admin/staff") {
        get {
            call.requireStaffWithRole(StaffRole.ADMIN) ?: return@get
            val staff = staffRepository.findAll()
            call.respond(HttpStatusCode.OK, staff.map { it.toResponse() })
        }

        post {
            val actor = call.requireStaffWithRole(StaffRole.ADMIN) ?: return@post
            val req = staffJson.decodeFromString<CreateStaffRequest>(call.receiveText())
            val role =
                runCatching { StaffRole.valueOf(req.role) }.getOrElse {
                    return@post call.respond(
                        HttpStatusCode.BadRequest,
                        mapOf("error" to "Invalid role: ${req.role}"),
                    )
                }
            runCatching {
                createStaff.execute(actor.staffId, req.email, req.name, role, req.password)
            }.fold(
                onSuccess = { call.respond(HttpStatusCode.Created, it.toResponse()) },
                onFailure = { e -> call.respondStaffError(e) },
            )
        }

        patch("{id}/role") {
            val actor = call.requireStaffWithRole(StaffRole.ADMIN) ?: return@patch
            val targetId = call.parseStaffId() ?: return@patch
            val req = staffJson.decodeFromString<UpdateStaffRoleRequest>(call.receiveText())
            val role =
                runCatching { StaffRole.valueOf(req.role) }.getOrElse {
                    return@patch call.respond(
                        HttpStatusCode.BadRequest,
                        mapOf("error" to "Invalid role: ${req.role}"),
                    )
                }
            runCatching {
                updateRole.execute(actor.staffId, targetId, role)
            }.fold(
                onSuccess = { call.respond(HttpStatusCode.OK, it.toResponse()) },
                onFailure = { e -> call.respondStaffError(e) },
            )
        }

        delete("{id}") {
            val actor = call.requireStaffWithRole(StaffRole.ADMIN) ?: return@delete
            val targetId = call.parseStaffId() ?: return@delete
            runCatching {
                deactivate.execute(actor.staffId, targetId)
            }.fold(
                onSuccess = { call.respond(HttpStatusCode.NoContent) },
                onFailure = { e -> call.respondStaffError(e) },
            )
        }
    }
}

private fun Route.auditLogRoutes() {
    val getAuditLog: IGetAuditLogUseCase by inject()
    val auditRepository: IAuditRepository by inject()

    get("/api/v1/admin/audit-logs") {
        call.requireStaffWithRole(StaffRole.ADMIN) ?: return@get
        val filters =
            AuditLogFilters(
                actorStaffId = call.request.queryParameters["staffId"]?.toUuidOrNull(),
                actorPlayerId = call.request.queryParameters["playerId"]?.toUuidOrNull(),
                entityType = call.request.queryParameters["entityType"],
                action = call.request.queryParameters["action"],
                from = call.request.queryParameters["from"]?.toInstantOrNull(),
                until = call.request.queryParameters["until"]?.toInstantOrNull(),
                offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0,
                limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: 50).coerceIn(1, 200),
            )
        val page = getAuditLog.execute(filters)
        call.respond(
            HttpStatusCode.OK,
            AuditLogPageResponse(
                items = page.items.map { it.toResponse() },
                offset = page.offset,
                limit = page.limit,
            ),
        )
    }

    get("/api/v1/admin/players/{id}/activity") {
        call.requireStaffWithRole(StaffRole.ADMIN) ?: return@get
        val rawId =
            call.parameters["id"] ?: return@get call.respond(
                HttpStatusCode.BadRequest,
                mapOf("error" to "Missing player id"),
            )
        val playerId =
            runCatching { PlayerId(UUID.fromString(rawId)) }.getOrElse {
                return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid player id"))
            }
        val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
        val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: 50).coerceIn(1, 200)
        val activity = auditRepository.findByActorPlayer(playerId, offset, limit)
        call.respond(HttpStatusCode.OK, AuditLogItemsResponse(items = activity.map { it.toResponse() }))
    }
}

// --- Response DTOs ---

@Serializable
private data class StaffResponse(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val isActive: Boolean,
    val lastLoginAt: String?,
    val createdAt: String,
)

@Serializable
private data class AuditLogResponse(
    val id: String,
    val actorType: String,
    val actorPlayerId: String?,
    val actorStaffId: String?,
    val action: String,
    val entityType: String,
    val entityId: String?,
    val beforeValue: String?,
    val afterValue: String?,
    val createdAt: String,
)

@Serializable
private data class AuditLogPageResponse(
    val items: List<AuditLogResponse>,
    val offset: Int,
    val limit: Int,
)

@Serializable
private data class AuditLogItemsResponse(
    val items: List<AuditLogResponse>,
)

// --- Helpers ---

private suspend fun io.ktor.server.application.ApplicationCall.parseStaffId(): StaffId? {
    val raw =
        parameters["id"] ?: run {
            respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing staff id"))
            return null
        }
    return runCatching { StaffId(UUID.fromString(raw)) }.getOrElse {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid staff id"))
        null
    }
}

private suspend fun io.ktor.server.application.ApplicationCall.respondStaffError(e: Throwable) {
    when (e) {
        is StaffNotFoundException ->
            respond(HttpStatusCode.NotFound, mapOf("error" to e.message))
        is StaffEmailAlreadyExistsException ->
            respond(HttpStatusCode.Conflict, mapOf("error" to e.message))
        is InsufficientRoleForAssignmentException ->
            respond(HttpStatusCode.Forbidden, mapOf("error" to e.message))
        is CannotDeactivateSelfException ->
            respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to e.message))
        is IllegalArgumentException ->
            respond(HttpStatusCode.BadRequest, mapOf("error" to e.message))
        else ->
            respond(HttpStatusCode.InternalServerError, mapOf("error" to "Unexpected error"))
    }
}

private fun Staff.toResponse(): StaffResponse =
    StaffResponse(
        id = id.toString(),
        name = name,
        email = email.value,
        role = role.name,
        isActive = isActive,
        lastLoginAt = lastLoginAt?.toString(),
        createdAt = createdAt.toString(),
    )

private fun AuditLog.toResponse(): AuditLogResponse =
    AuditLogResponse(
        id = id.toString(),
        actorType = actorType.name,
        actorPlayerId = actorPlayerId?.value?.toString(),
        actorStaffId = actorStaffId?.toString(),
        action = action,
        entityType = entityType,
        entityId = entityId?.toString(),
        beforeValue = beforeValue?.toString(),
        afterValue = afterValue?.toString(),
        createdAt = createdAt.toString(),
    )

private fun String.toUuidOrNull(): UUID? = runCatching { UUID.fromString(this) }.getOrNull()

private fun String.toInstantOrNull(): Instant? = runCatching { Instant.parse(this) }.getOrNull()
