package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.domain.entities.PrizeAcquisitionMethod
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.PrizeInstance
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import com.prizedraw.infrastructure.persistence.tables.PrizeDefinitionsTable
import com.prizedraw.infrastructure.persistence.tables.PrizeInstancesTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.or
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset

public class PrizeRepositoryImpl : IPrizeRepository {
    private val json = Json { ignoreUnknownKeys = true }

    // --- Prize Definitions ---

    override suspend fun findDefinitionById(id: PrizeDefinitionId): PrizeDefinition? =
        newSuspendedTransaction {
            PrizeDefinitionsTable
                .selectAll()
                .where { PrizeDefinitionsTable.id eq id.value }
                .singleOrNull()
                ?.toPrizeDefinition()
        }

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

    override suspend fun saveDefinition(definition: PrizeDefinition): PrizeDefinition =
        newSuspendedTransaction {
            val photosJson =
                buildJsonArray {
                    definition.photos.forEach { add(JsonPrimitive(it)) }
                }.toString()
            val existing =
                PrizeDefinitionsTable
                    .selectAll()
                    .where { PrizeDefinitionsTable.id eq definition.id.value }
                    .singleOrNull()
            if (existing == null) {
                PrizeDefinitionsTable.insert {
                    it[id] = definition.id.value
                    it[kujiCampaignId] = definition.kujiCampaignId?.value
                    it[unlimitedCampaignId] = definition.unlimitedCampaignId?.value
                    it[grade] = definition.grade
                    it[name] = definition.name
                    it[photos] = photosJson
                    it[prizeValue] = definition.prizeValue
                    it[buybackPrice] = definition.buybackPrice
                    it[buybackEnabled] = definition.buybackEnabled
                    it[probabilityBps] = definition.probabilityBps
                    it[ticketCount] = definition.ticketCount
                    it[displayOrder] = definition.displayOrder
                    it[createdAt] = definition.createdAt.toOffsetDateTime()
                    it[updatedAt] = definition.updatedAt.toOffsetDateTime()
                }
            } else {
                PrizeDefinitionsTable.update({ PrizeDefinitionsTable.id eq definition.id.value }) {
                    it[buybackPrice] = definition.buybackPrice
                    it[buybackEnabled] = definition.buybackEnabled
                    it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
                }
            }
            PrizeDefinitionsTable
                .selectAll()
                .where { PrizeDefinitionsTable.id eq definition.id.value }
                .single()
                .toPrizeDefinition()
        }

    // --- Prize Instances ---

    override suspend fun findInstanceById(id: PrizeInstanceId): PrizeInstance? =
        newSuspendedTransaction {
            PrizeInstancesTable
                .selectAll()
                .where {
                    (PrizeInstancesTable.id eq id.value) and
                        (PrizeInstancesTable.deletedAt.isNull())
                }.singleOrNull()
                ?.toPrizeInstance()
        }

    override suspend fun findInstancesByOwner(
        ownerId: PlayerId,
        state: PrizeState?,
    ): List<PrizeInstance> =
        newSuspendedTransaction {
            PrizeInstancesTable
                .selectAll()
                .where {
                    val base =
                        (PrizeInstancesTable.ownerId eq ownerId.value) and
                            (PrizeInstancesTable.deletedAt.isNull())
                    if (state != null) {
                        base and (PrizeInstancesTable.state eq state)
                    } else {
                        base
                    }
                }.map { it.toPrizeInstance() }
        }

    override suspend fun saveInstance(instance: PrizeInstance): PrizeInstance =
        newSuspendedTransaction {
            PrizeInstancesTable.insert {
                it[id] = instance.id.value
                it[prizeDefinitionId] = instance.prizeDefinitionId.value
                it[ownerId] = instance.ownerId.value
                it[acquisitionMethod] = instance.acquisitionMethod
                it[sourceDrawTicketId] = instance.sourceDrawTicketId
                it[sourceTradeOrderId] = instance.sourceTradeOrderId
                it[sourceExchangeRequestId] = instance.sourceExchangeRequestId
                it[state] = instance.state
                it[acquiredAt] = instance.acquiredAt.toOffsetDateTime()
                it[deletedAt] = instance.deletedAt?.toOffsetDateTime()
                it[createdAt] = instance.createdAt.toOffsetDateTime()
                it[updatedAt] = instance.updatedAt.toOffsetDateTime()
            }
            PrizeInstancesTable
                .selectAll()
                .where { PrizeInstancesTable.id eq instance.id.value }
                .single()
                .toPrizeInstance()
        }

    override suspend fun updateInstanceState(
        id: PrizeInstanceId,
        newState: PrizeState,
        expectedState: PrizeState,
    ): Boolean =
        newSuspendedTransaction {
            val rows =
                PrizeInstancesTable.update({
                    (PrizeInstancesTable.id eq id.value) and
                        (PrizeInstancesTable.state eq expectedState)
                }) {
                    it[state] = newState
                    it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
                }
            rows > 0
        }

    override suspend fun transferOwnership(
        instanceId: PrizeInstanceId,
        newOwnerId: PlayerId,
        newState: PrizeState,
    ): PrizeInstance =
        newSuspendedTransaction {
            PrizeInstancesTable.update({ PrizeInstancesTable.id eq instanceId.value }) {
                it[ownerId] = newOwnerId.value
                it[state] = newState
                it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
            PrizeInstancesTable
                .selectAll()
                .where { PrizeInstancesTable.id eq instanceId.value }
                .single()
                .toPrizeInstance()
        }

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
            name = this[PrizeDefinitionsTable.name],
            photos = photos,
            prizeValue = this[PrizeDefinitionsTable.prizeValue],
            buybackPrice = this[PrizeDefinitionsTable.buybackPrice],
            buybackEnabled = this[PrizeDefinitionsTable.buybackEnabled],
            probabilityBps = this[PrizeDefinitionsTable.probabilityBps],
            ticketCount = this[PrizeDefinitionsTable.ticketCount],
            displayOrder = this[PrizeDefinitionsTable.displayOrder],
            createdAt = this[PrizeDefinitionsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PrizeDefinitionsTable.updatedAt].toInstant().toKotlinInstant(),
        )
    }

    private fun ResultRow.toPrizeInstance(): PrizeInstance =
        PrizeInstance(
            id = PrizeInstanceId(this[PrizeInstancesTable.id]),
            prizeDefinitionId = PrizeDefinitionId(this[PrizeInstancesTable.prizeDefinitionId]),
            ownerId = PlayerId(this[PrizeInstancesTable.ownerId]),
            acquisitionMethod = this[PrizeInstancesTable.acquisitionMethod],
            sourceDrawTicketId = this[PrizeInstancesTable.sourceDrawTicketId],
            sourceTradeOrderId = this[PrizeInstancesTable.sourceTradeOrderId],
            sourceExchangeRequestId = this[PrizeInstancesTable.sourceExchangeRequestId],
            state = this[PrizeInstancesTable.state],
            acquiredAt = this[PrizeInstancesTable.acquiredAt].toInstant().toKotlinInstant(),
            deletedAt = this[PrizeInstancesTable.deletedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[PrizeInstancesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PrizeInstancesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

private fun kotlinx.datetime.Instant.toOffsetDateTime(): java.time.OffsetDateTime =
    java.time.OffsetDateTime.ofInstant(toJavaInstant(), java.time.ZoneOffset.UTC)
