package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.contracts.endpoints.AdminEndpoints
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.schema.tables.KujiCampaignsTable
import com.prizedraw.schema.tables.PrizeDefinitionsTable
import com.prizedraw.schema.tables.UnlimitedCampaignsTable
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.leftJoin
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction

/**
 * Admin routes for prize definition management.
 *
 * All routes require `authenticate("staff")` in the parent scope.
 *
 * - GET [AdminEndpoints.PRIZES] — List all prize definitions joined with their campaign name
 */
public fun Route.adminPrizesRoutes() {
    get(AdminEndpoints.PRIZES) {
        call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@get
        val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: 200).coerceIn(1, 500)
        val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0

        val json = Json { ignoreUnknownKeys = true }

        val prizes: List<AdminPrizeDefinitionResponse> =
            newSuspendedTransaction {
                PrizeDefinitionsTable
                    .leftJoin(KujiCampaignsTable, { PrizeDefinitionsTable.kujiCampaignId }, { KujiCampaignsTable.id })
                    .leftJoin(
                        UnlimitedCampaignsTable,
                        { PrizeDefinitionsTable.unlimitedCampaignId },
                        { UnlimitedCampaignsTable.id },
                    ).selectAll()
                    .orderBy(PrizeDefinitionsTable.displayOrder, SortOrder.ASC)
                    .limit(limit, offset.toLong())
                    .map { row ->
                        val kujiId = row.getOrNull(KujiCampaignsTable.id)
                        val unlimitedId = row.getOrNull(UnlimitedCampaignsTable.id)
                        val campaignId = (kujiId ?: unlimitedId)?.toString() ?: ""
                        val campaignName =
                            when {
                                kujiId != null -> row.getOrNull(KujiCampaignsTable.title) ?: ""
                                unlimitedId != null -> row.getOrNull(UnlimitedCampaignsTable.title) ?: ""
                                else -> ""
                            }

                        val photosJson = row[PrizeDefinitionsTable.photos]
                        val firstPhoto: String? =
                            runCatching {
                                val arr = json.parseToJsonElement(photosJson) as? JsonArray
                                arr?.firstOrNull()?.jsonPrimitive?.content
                            }.getOrNull()

                        AdminPrizeDefinitionResponse(
                            id = row[PrizeDefinitionsTable.id].toString(),
                            campaignId = campaignId,
                            campaignName = campaignName,
                            grade = row[PrizeDefinitionsTable.grade],
                            name = row[PrizeDefinitionsTable.name],
                            photoUrl = firstPhoto,
                            buybackPrice = row[PrizeDefinitionsTable.buybackPrice].toString(),
                            buybackEnabled = row[PrizeDefinitionsTable.buybackEnabled].toString(),
                            totalCount = row[PrizeDefinitionsTable.ticketCount]?.toString(),
                        )
                    }
            }

        call.respond(HttpStatusCode.OK, prizes)
    }
}

@Serializable
private data class AdminPrizeDefinitionResponse(
    val id: String,
    val campaignId: String,
    val campaignName: String,
    val grade: String,
    val name: String,
    val photoUrl: String?,
    val buybackPrice: String,
    val buybackEnabled: String,
    val totalCount: String?,
)
