package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.contracts.enums.AuditActorType
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.schema.tables.AuditLogsTable
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greaterEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.lessEq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.time.OffsetDateTime
import java.util.UUID

private const val ADMIN_AUDIT_PATH = "/api/v1/admin/audit"
private const val DEFAULT_AUDIT_LIMIT = 50
private const val MAX_AUDIT_LIMIT = 200

@Serializable
private data class AuditEntryResponse(
    val id: String,
    val actorType: String,
    val actorPlayerId: String?,
    val actorStaffId: String?,
    val action: String,
    val entityType: String,
    val entityId: String?,
    val beforeValue: String?,
    val afterValue: String?,
    val metadata: String,
    val createdAt: String,
)

@Serializable
private data class AuditEntryPageResponse(
    val items: List<AuditEntryResponse>,
    val offset: Int,
    val limit: Int,
)

/**
 * Admin audit log routes.
 *
 * All routes require `authenticate("staff")` in the parent scope and [StaffRole.ADMIN].
 *
 * - GET /api/v1/admin/audit — paginated audit log with optional filters
 *
 * Query parameters:
 * - `actorType`  — one of [AuditActorType] values (optional)
 * - `staffId`    — filter by actor staff UUID (optional)
 * - `playerId`   — filter by actor player UUID (optional)
 * - `entityType` — filter by entity type string (optional)
 * - `action`     — filter by action string (optional)
 * - `from`       — ISO-8601 lower bound for `created_at` (optional)
 * - `until`      — ISO-8601 upper bound for `created_at` (optional)
 * - `offset`     — pagination offset, defaults to 0
 * - `limit`      — page size 1–200, defaults to 50
 */
public fun Route.adminAuditRoutes() {
    get(ADMIN_AUDIT_PATH) {
        call.requireStaffWithRole(StaffRole.ADMIN) ?: return@get

        val actorTypeParam = call.request.queryParameters["actorType"]
        val staffIdParam = call.request.queryParameters["staffId"]
        val playerIdParam = call.request.queryParameters["playerId"]
        val entityTypeParam = call.request.queryParameters["entityType"]
        val actionParam = call.request.queryParameters["action"]
        val fromParam = call.request.queryParameters["from"]
        val untilParam = call.request.queryParameters["until"]
        val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
        val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: DEFAULT_AUDIT_LIMIT).coerceIn(1, MAX_AUDIT_LIMIT)

        val actorTypeFilter =
            actorTypeParam?.let {
                runCatching { AuditActorType.valueOf(it) }.getOrElse {
                    return@get call.respond(
                        HttpStatusCode.BadRequest,
                        mapOf("error" to "Invalid actorType: $it"),
                    )
                }
            }

        val staffIdFilter =
            staffIdParam?.let {
                runCatching { UUID.fromString(it) }.getOrElse {
                    return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid staffId UUID"))
                }
            }

        val playerIdFilter =
            playerIdParam?.let {
                runCatching { UUID.fromString(it) }.getOrElse {
                    return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid playerId UUID"))
                }
            }

        val fromFilter =
            fromParam?.let {
                runCatching { OffsetDateTime.parse(it) }.getOrElse {
                    return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid 'from' timestamp, expected ISO-8601"))
                }
            }

        val untilFilter =
            untilParam?.let {
                runCatching { OffsetDateTime.parse(it) }.getOrElse {
                    return@get call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid 'until' timestamp, expected ISO-8601"))
                }
            }

        val page =
            newSuspendedTransaction {
                AuditLogsTable
                    .selectAll()
                    .apply {
                        val conditions = mutableListOf<org.jetbrains.exposed.sql.Op<Boolean>>()

                        if (actorTypeFilter != null) {
                            conditions += AuditLogsTable.actorType eq actorTypeFilter
                        }
                        if (staffIdFilter != null) {
                            conditions += AuditLogsTable.actorStaffId eq staffIdFilter
                        }
                        if (playerIdFilter != null) {
                            conditions += AuditLogsTable.actorPlayerId eq playerIdFilter
                        }
                        if (entityTypeParam != null) {
                            conditions += AuditLogsTable.entityType eq entityTypeParam
                        }
                        if (actionParam != null) {
                            conditions += AuditLogsTable.action eq actionParam
                        }
                        if (fromFilter != null) {
                            conditions += AuditLogsTable.createdAt greaterEq fromFilter
                        }
                        if (untilFilter != null) {
                            conditions += AuditLogsTable.createdAt lessEq untilFilter
                        }

                        if (conditions.isNotEmpty()) {
                            where { conditions.reduce { acc, op -> acc and op } }
                        }
                    }.orderBy(AuditLogsTable.createdAt, SortOrder.DESC)
                    .limit(limit, offset.toLong())
                    .map { row ->
                        AuditEntryResponse(
                            id = row[AuditLogsTable.id].toString(),
                            actorType = row[AuditLogsTable.actorType].name,
                            actorPlayerId = row[AuditLogsTable.actorPlayerId]?.toString(),
                            actorStaffId = row[AuditLogsTable.actorStaffId]?.toString(),
                            action = row[AuditLogsTable.action],
                            entityType = row[AuditLogsTable.entityType],
                            entityId = row[AuditLogsTable.entityId]?.toString(),
                            beforeValue = row[AuditLogsTable.beforeValue],
                            afterValue = row[AuditLogsTable.afterValue],
                            metadata = row[AuditLogsTable.metadata],
                            createdAt = row[AuditLogsTable.createdAt].toString(),
                        )
                    }
            }

        call.respond(HttpStatusCode.OK, AuditEntryPageResponse(items = page, offset = offset, limit = limit))
    }
}
