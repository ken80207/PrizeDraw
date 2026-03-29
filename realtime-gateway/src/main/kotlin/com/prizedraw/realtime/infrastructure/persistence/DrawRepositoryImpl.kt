package com.prizedraw.realtime.infrastructure.persistence

import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.valueobjects.CampaignGradeId
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.realtime.ports.IDrawRepository
import com.prizedraw.schema.tables.PrizeDefinitionsTable
import kotlinx.datetime.toKotlinInstant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.or
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction

/**
 * Exposed-backed implementation of [IDrawRepository] for the realtime-gateway.
 *
 * Only implements the prize definition query needed for the kuji board snapshot.
 */
public class DrawRepositoryImpl : IDrawRepository {
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun findDefinitionsByCampaign(
        campaignId: CampaignId,
        type: CampaignType?,
    ): List<PrizeDefinition> =
        newSuspendedTransaction {
            PrizeDefinitionsTable
                .selectAll()
                .where {
                    when (type) {
                        CampaignType.KUJI -> PrizeDefinitionsTable.kujiCampaignId eq campaignId.value
                        CampaignType.UNLIMITED -> PrizeDefinitionsTable.unlimitedCampaignId eq campaignId.value
                        null ->
                            (PrizeDefinitionsTable.kujiCampaignId eq campaignId.value) or
                                (PrizeDefinitionsTable.unlimitedCampaignId eq campaignId.value)
                    }
                }.orderBy(PrizeDefinitionsTable.displayOrder)
                .map { it.toPrizeDefinition() }
        }

    @Suppress("TooGenericExceptionCaught")
    private fun ResultRow.toPrizeDefinition(): PrizeDefinition {
        val photosJson = this[PrizeDefinitionsTable.photos]
        val photos =
            try {
                val arr = json.parseToJsonElement(photosJson) as? JsonArray ?: JsonArray(emptyList())
                arr.map { it.jsonPrimitive.content }
            } catch (_: Exception) {
                emptyList()
            }
        return PrizeDefinition(
            id = PrizeDefinitionId(this[PrizeDefinitionsTable.id]),
            kujiCampaignId = this[PrizeDefinitionsTable.kujiCampaignId]?.let { CampaignId(it) },
            unlimitedCampaignId = this[PrizeDefinitionsTable.unlimitedCampaignId]?.let { CampaignId(it) },
            grade = this[PrizeDefinitionsTable.grade],
            campaignGradeId = this[PrizeDefinitionsTable.campaignGradeId]?.let { CampaignGradeId(it) },
            name = this[PrizeDefinitionsTable.name],
            photos = photos,
            prizeValue = this[PrizeDefinitionsTable.prizeValue],
            buybackPrice = this[PrizeDefinitionsTable.buybackPrice],
            buybackEnabled = this[PrizeDefinitionsTable.buybackEnabled],
            probabilityBps = this[PrizeDefinitionsTable.probabilityBps],
            ticketCount = this[PrizeDefinitionsTable.ticketCount],
            displayOrder = this[PrizeDefinitionsTable.displayOrder],
            isRare = this[PrizeDefinitionsTable.isRare],
            createdAt = this[PrizeDefinitionsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PrizeDefinitionsTable.updatedAt].toInstant().toKotlinInstant(),
        )
    }
}
