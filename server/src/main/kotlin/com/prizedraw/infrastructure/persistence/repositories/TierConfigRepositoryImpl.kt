package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.ITierConfigRepository
import com.prizedraw.domain.entities.TierConfig
import com.prizedraw.infrastructure.persistence.tables.TierConfigsTable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction

/**
 * Exposed-backed implementation of [ITierConfigRepository].
 *
 * The `benefits` column is stored as a raw JSON string in PostgreSQL (JSONB).
 * We parse it into [JsonObject] at the repository boundary so upper layers receive
 * fully-typed domain objects.
 */
public class TierConfigRepositoryImpl : ITierConfigRepository {
    override suspend fun findAll(): List<TierConfig> =
        newSuspendedTransaction {
            TierConfigsTable
                .selectAll()
                .orderBy(TierConfigsTable.sortOrder, SortOrder.ASC)
                .map { it.toTierConfig() }
        }

    override suspend fun findByTier(tier: String): TierConfig? =
        newSuspendedTransaction {
            TierConfigsTable
                .selectAll()
                .where { TierConfigsTable.tier eq tier }
                .singleOrNull()
                ?.toTierConfig()
        }

    private fun org.jetbrains.exposed.sql.ResultRow.toTierConfig(): TierConfig =
        TierConfig(
            tier = this[TierConfigsTable.tier],
            displayName = this[TierConfigsTable.displayName],
            minXp = this[TierConfigsTable.minXp],
            icon = this[TierConfigsTable.icon],
            color = this[TierConfigsTable.color],
            benefits = parseBenefits(this[TierConfigsTable.benefits]),
            sortOrder = this[TierConfigsTable.sortOrder],
        )

    private fun parseBenefits(raw: String): JsonObject =
        runCatching { Json.parseToJsonElement(raw) as? JsonObject }
            .getOrNull()
            ?: JsonObject(emptyMap())
}
