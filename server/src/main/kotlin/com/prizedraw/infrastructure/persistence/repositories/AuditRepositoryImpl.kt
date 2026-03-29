package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.schema.tables.AuditLogsTable
import kotlinx.datetime.Instant
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.jetbrains.exposed.sql.Op
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greaterEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.lessEq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.like
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.transactions.transaction
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID
import com.prizedraw.contracts.enums.AuditActorType as ContractsAuditActorType

public class AuditRepositoryImpl : IAuditRepository {
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Synchronous insert for use within an existing business transaction.
     * Uses [transaction] (not [newSuspendedTransaction]) so it joins the caller's transaction.
     */
    override fun record(log: AuditLog) {
        AuditLogsTable.insert {
            it[id] = log.id
            it[actorType] = log.actorType.toContractsEnum()
            it[actorPlayerId] = log.actorPlayerId?.value
            it[actorStaffId] = log.actorStaffId
            it[action] = log.action
            it[entityType] = log.entityType
            it[entityId] = log.entityId
            it[beforeValue] = log.beforeValue?.let { v -> json.encodeToString(JsonObject.serializer(), v) }
            it[afterValue] = log.afterValue?.let { v -> json.encodeToString(JsonObject.serializer(), v) }
            it[metadata] = json.encodeToString(JsonObject.serializer(), log.metadata)
            it[createdAt] = OffsetDateTime.ofInstant(log.createdAt.toJavaInstant(), ZoneOffset.UTC)
        }
    }

    override suspend fun findByActorPlayer(
        actorPlayerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<AuditLog> =
        newSuspendedTransaction {
            AuditLogsTable
                .selectAll()
                .where { AuditLogsTable.actorPlayerId eq actorPlayerId.value }
                .orderBy(AuditLogsTable.createdAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toAuditLog() }
        }

    override suspend fun findByEntity(
        entityType: String,
        entityId: UUID,
        offset: Int,
        limit: Int,
    ): List<AuditLog> =
        newSuspendedTransaction {
            AuditLogsTable
                .selectAll()
                .where {
                    (AuditLogsTable.entityType eq entityType) and
                        (AuditLogsTable.entityId eq entityId)
                }.orderBy(AuditLogsTable.createdAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toAuditLog() }
        }

    override suspend fun findFiltered(
        actorStaffId: UUID?,
        actorPlayerId: UUID?,
        entityType: String?,
        action: String?,
        from: Instant?,
        until: Instant?,
        offset: Int,
        limit: Int,
    ): List<AuditLog> =
        newSuspendedTransaction {
            AuditLogsTable
                .selectAll()
                .where {
                    var condition: Op<Boolean> = Op.TRUE
                    if (actorStaffId != null) {
                        condition = condition and (AuditLogsTable.actorStaffId eq actorStaffId)
                    }
                    if (actorPlayerId != null) {
                        condition = condition and (AuditLogsTable.actorPlayerId eq actorPlayerId)
                    }
                    if (entityType != null) {
                        condition = condition and (AuditLogsTable.entityType eq entityType)
                    }
                    if (action != null) {
                        condition = condition and (AuditLogsTable.action like "$action%")
                    }
                    if (from != null) {
                        val fromOdt = OffsetDateTime.ofInstant(from.toJavaInstant(), ZoneOffset.UTC)
                        condition = condition and (AuditLogsTable.createdAt greaterEq fromOdt)
                    }
                    if (until != null) {
                        val untilOdt = OffsetDateTime.ofInstant(until.toJavaInstant(), ZoneOffset.UTC)
                        condition = condition and (AuditLogsTable.createdAt lessEq untilOdt)
                    }
                    condition
                }.orderBy(AuditLogsTable.createdAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toAuditLog() }
        }

    private fun ResultRow.toAuditLog(): AuditLog =
        AuditLog(
            id = this[AuditLogsTable.id],
            actorType = this[AuditLogsTable.actorType].toDomainEnum(),
            actorPlayerId = this[AuditLogsTable.actorPlayerId]?.let { PlayerId(it) },
            actorStaffId = this[AuditLogsTable.actorStaffId],
            action = this[AuditLogsTable.action],
            entityType = this[AuditLogsTable.entityType],
            entityId = this[AuditLogsTable.entityId],
            beforeValue =
                this[AuditLogsTable.beforeValue]?.let {
                    json.parseToJsonElement(it) as? JsonObject
                },
            afterValue =
                this[AuditLogsTable.afterValue]?.let {
                    json.parseToJsonElement(it) as? JsonObject
                },
            metadata = json.parseToJsonElement(this[AuditLogsTable.metadata]) as JsonObject,
            createdAt = this[AuditLogsTable.createdAt].toInstant().toKotlinInstant(),
        )
}

// Enum adapters between domain layer and contracts layer (same values, different packages).

private fun AuditActorType.toContractsEnum(): ContractsAuditActorType = enumValueOf(name)

private fun ContractsAuditActorType.toDomainEnum(): AuditActorType = enumValueOf(name)
