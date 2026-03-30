package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.schema.tables.SystemSettingsTable
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.request.receiveText
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import io.ktor.server.routing.patch
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.upsert
import java.time.OffsetDateTime
import java.time.ZoneOffset

private const val ADMIN_SETTINGS_PATH = "/api/v1/admin/settings"

@Serializable
private data class SettingEntry(
    val key: String,
    val value: String,
    val updatedAt: String?,
    val updatedBy: String?,
)

@Serializable
private data class UpdateSettingsRequest(
    val settings: Map<String, String>,
)

private val settingsJson =
    Json {
        isLenient = true
        ignoreUnknownKeys = true
    }

/**
 * Admin system settings routes.
 *
 * All routes require `authenticate("staff")` in the parent scope and [StaffRole.ADMIN].
 *
 * - GET   /api/v1/admin/settings — list all system_settings as key-value pairs
 * - PATCH /api/v1/admin/settings — upsert one or more setting values
 */
public fun Route.adminSettingsRoutes() {
    get(ADMIN_SETTINGS_PATH) {
        call.requireStaffWithRole(StaffRole.ADMIN) ?: return@get

        val settings =
            newSuspendedTransaction {
                SystemSettingsTable
                    .selectAll()
                    .orderBy(SystemSettingsTable.key, SortOrder.ASC)
                    .map { row ->
                        SettingEntry(
                            key = row[SystemSettingsTable.key],
                            value = row[SystemSettingsTable.value],
                            updatedAt = row[SystemSettingsTable.updatedAt]?.toString(),
                            updatedBy = row[SystemSettingsTable.updatedBy]?.toString(),
                        )
                    }
            }

        call.respond(HttpStatusCode.OK, settings)
    }

    patch(ADMIN_SETTINGS_PATH) {
        val actor = call.requireStaffWithRole(StaffRole.ADMIN) ?: return@patch

        val body = call.receiveText()
        val parsed =
            runCatching { settingsJson.decodeFromString<JsonObject>(body) }.getOrElse {
                return@patch call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid JSON body"))
            }

        if (parsed.isEmpty()) {
            return@patch call.respond(HttpStatusCode.BadRequest, mapOf("error" to "No settings provided"))
        }

        val updatedSettings =
            newSuspendedTransaction {
                val now = OffsetDateTime.now(ZoneOffset.UTC)
                parsed.forEach { (key, valueElement) ->
                    val rawValue =
                        runCatching { valueElement.jsonPrimitive.content }.getOrElse {
                            valueElement.toString()
                        }
                    SystemSettingsTable.upsert {
                        it[SystemSettingsTable.key] = key
                        it[SystemSettingsTable.value] = rawValue
                        it[SystemSettingsTable.updatedAt] = now
                        it[SystemSettingsTable.updatedBy] = actor.staffId.value
                    }
                }

                SystemSettingsTable
                    .selectAll()
                    .where { SystemSettingsTable.key inList parsed.keys.toList() }
                    .orderBy(SystemSettingsTable.key, SortOrder.ASC)
                    .map { row ->
                        SettingEntry(
                            key = row[SystemSettingsTable.key],
                            value = row[SystemSettingsTable.value],
                            updatedAt = row[SystemSettingsTable.updatedAt]?.toString(),
                            updatedBy = row[SystemSettingsTable.updatedBy]?.toString(),
                        )
                    }
            }

        call.respond(HttpStatusCode.OK, updatedSettings)
    }
}
