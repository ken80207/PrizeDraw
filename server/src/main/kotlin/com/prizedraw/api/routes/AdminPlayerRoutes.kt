package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.contracts.endpoints.AdminEndpoints
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.entities.Player
import com.prizedraw.infrastructure.persistence.tables.PlayersTable
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.lowerCase
import org.jetbrains.exposed.sql.or
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction

/**
 * Admin routes for player management.
 *
 * All routes require `authenticate("staff")` in the parent scope.
 *
 * - GET [AdminEndpoints.PLAYERS] — List all players with optional `?search=` query param
 *   filtering by nickname or phone number.
 */
public fun Route.adminPlayerRoutes() {
    val playerRepository: IPlayerRepository by inject()

    get(AdminEndpoints.PLAYERS) {
        call.requireStaffWithRole(StaffRole.ADMIN) ?: return@get
        val search =
            call.request.queryParameters["search"]
                ?.trim()
                ?.takeIf { it.isNotEmpty() }
        val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
        val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: 50).coerceIn(1, 200)

        val responses: List<AdminPlayerResponse> =
            if (search != null) {
                val pattern = "%${search.lowercase()}%"
                newSuspendedTransaction {
                    PlayersTable
                        .selectAll()
                        .where {
                            (PlayersTable.deletedAt.isNull()) and
                                (
                                    (PlayersTable.nickname.lowerCase() like pattern) or
                                        (PlayersTable.phoneNumber.lowerCase() like pattern)
                                )
                        }.orderBy(PlayersTable.createdAt, SortOrder.DESC)
                        .limit(limit, offset.toLong())
                        .map { row ->
                            AdminPlayerResponse(
                                id = row[PlayersTable.id].toString(),
                                nickname = row[PlayersTable.nickname],
                                phoneNumber = row[PlayersTable.phoneNumber],
                                drawPointsBalance = row[PlayersTable.drawPointsBalance].toString(),
                                revenuePointsBalance = row[PlayersTable.revenuePointsBalance].toString(),
                                isActive = row[PlayersTable.isActive].toString(),
                                createdAt = row[PlayersTable.createdAt].toString(),
                            )
                        }
                }
            } else {
                playerRepository
                    .findAll(offset = offset, limit = limit)
                    .map { it.toAdminResponse() }
            }

        call.respond(HttpStatusCode.OK, responses)
    }
}

@Serializable
private data class AdminPlayerResponse(
    val id: String,
    val nickname: String,
    val phoneNumber: String?,
    val drawPointsBalance: String,
    val revenuePointsBalance: String,
    val isActive: String,
    val createdAt: String,
)

private fun Player.toAdminResponse(): AdminPlayerResponse =
    AdminPlayerResponse(
        id = id.value.toString(),
        nickname = nickname,
        phoneNumber = phoneNumber?.value,
        drawPointsBalance = drawPointsBalance.toString(),
        revenuePointsBalance = revenuePointsBalance.toString(),
        isActive = isActive.toString(),
        createdAt = createdAt.toString(),
    )
