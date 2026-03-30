package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.contracts.endpoints.AdminEndpoints
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.schema.tables.FeatureFlagsTable
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.request.receiveText
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.util.UUID

@Serializable
private data class FeatureFlagResponse(
    val id: String,
    val name: String,
    val displayName: String,
    val description: String?,
    val enabled: Boolean,
    val rules: String,
    val updatedByStaffId: String?,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
private data class UpdateFeatureFlagRequest(
    val enabled: Boolean,
)

private val featureFlagJson =
    Json {
        isLenient = true
        ignoreUnknownKeys = true
    }

/**
 * Admin feature flag management routes.
 *
 * All routes require `authenticate("staff")` in the parent scope and [StaffRole.ADMIN].
 *
 * - GET  [AdminEndpoints.FEATURE_FLAGS]     — list all feature flags
 * - PATCH [AdminEndpoints.FEATURE_FLAG_BY_ID] — toggle a flag's `enabled` field
 */
public fun Route.adminFeatureFlagRoutes() {
    get(AdminEndpoints.FEATURE_FLAGS) {
        call.requireStaffWithRole(StaffRole.ADMIN) ?: return@get

        val flags =
            newSuspendedTransaction {
                FeatureFlagsTable
                    .selectAll()
                    .orderBy(FeatureFlagsTable.name, SortOrder.ASC)
                    .map { row ->
                        FeatureFlagResponse(
                            id = row[FeatureFlagsTable.id].toString(),
                            name = row[FeatureFlagsTable.name],
                            displayName = row[FeatureFlagsTable.displayName],
                            description = row[FeatureFlagsTable.description],
                            enabled = row[FeatureFlagsTable.enabled],
                            rules = row[FeatureFlagsTable.rules],
                            updatedByStaffId = row[FeatureFlagsTable.updatedByStaffId]?.toString(),
                            createdAt = row[FeatureFlagsTable.createdAt].toString(),
                            updatedAt = row[FeatureFlagsTable.updatedAt].toString(),
                        )
                    }
            }

        call.respond(HttpStatusCode.OK, flags)
    }

    patch(AdminEndpoints.FEATURE_FLAG_BY_ID) {
        val actor = call.requireStaffWithRole(StaffRole.ADMIN) ?: return@patch

        val rawId =
            call.parameters["flagId"] ?: return@patch call.respond(
                HttpStatusCode.BadRequest,
                mapOf("error" to "Missing flagId"),
            )
        val flagId =
            runCatching { UUID.fromString(rawId) }.getOrElse {
                return@patch call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid flagId"))
            }

        val req =
            runCatching {
                featureFlagJson.decodeFromString<UpdateFeatureFlagRequest>(call.receiveText())
            }.getOrElse {
                return@patch call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid request body"))
            }

        val updated =
            newSuspendedTransaction {
                val rows =
                    FeatureFlagsTable.update({ FeatureFlagsTable.id eq flagId }) { stmt ->
                        stmt[enabled] = req.enabled
                        stmt[updatedByStaffId] = actor.staffId.value
                    }

                if (rows == 0) {
                    return@newSuspendedTransaction null
                }

                FeatureFlagsTable
                    .selectAll()
                    .where { FeatureFlagsTable.id eq flagId }
                    .single()
                    .let { row ->
                        FeatureFlagResponse(
                            id = row[FeatureFlagsTable.id].toString(),
                            name = row[FeatureFlagsTable.name],
                            displayName = row[FeatureFlagsTable.displayName],
                            description = row[FeatureFlagsTable.description],
                            enabled = row[FeatureFlagsTable.enabled],
                            rules = row[FeatureFlagsTable.rules],
                            updatedByStaffId = row[FeatureFlagsTable.updatedByStaffId]?.toString(),
                            createdAt = row[FeatureFlagsTable.createdAt].toString(),
                            updatedAt = row[FeatureFlagsTable.updatedAt].toString(),
                        )
                    }
            }

        if (updated == null) {
            call.respond(HttpStatusCode.NotFound, mapOf("error" to "Feature flag not found"))
        } else {
            call.respond(HttpStatusCode.OK, updated)
        }
    }
}
