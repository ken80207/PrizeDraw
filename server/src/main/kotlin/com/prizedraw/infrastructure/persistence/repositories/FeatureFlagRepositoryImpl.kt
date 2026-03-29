package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.FeatureFlagContext
import com.prizedraw.application.ports.output.IFeatureFlagRepository
import com.prizedraw.domain.entities.FeatureFlag
import com.prizedraw.schema.tables.FeatureFlagsTable
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.concurrent.ConcurrentHashMap
import kotlin.math.abs

/**
 * In-memory cached implementation of [IFeatureFlagRepository].
 *
 * Flags are cached for [CACHE_TTL_SECONDS] seconds (30s) to satisfy the FR-087
 * requirement of <30s propagation latency. Cache is invalidated on [save].
 *
 * [isEnabled] is synchronous and evaluates targeting rules in priority order:
 * 1. Global master switch ([FeatureFlag.enabled])
 * 2. Platform targeting
 * 3. Group targeting
 * 4. Percentage rollout (stable hash on playerId)
 */
public class FeatureFlagRepositoryImpl : IFeatureFlagRepository {
    private val json = Json { ignoreUnknownKeys = true }

    private data class CacheEntry(
        val flag: FeatureFlag,
        val fetchedAt: Instant,
    )

    private val cache = ConcurrentHashMap<String, CacheEntry>()

    @Suppress("CyclomaticComplexMethod", "ReturnCount")
    override fun isEnabled(
        key: String,
        context: FeatureFlagContext,
    ): Boolean {
        val flag = getCached(key) ?: return false

        // Step 1: global master switch
        if (!flag.enabled) {
            return false
        }

        val rules = flag.rules
        if (rules.isEmpty()) {
            return true
        }

        // Step 2: platform targeting
        val platforms = rules["platforms"]?.jsonArray
        if (platforms != null && context.platform != null) {
            val allowed = platforms.map { it.jsonPrimitive.content }
            if (allowed.isNotEmpty() && context.platform !in allowed) {
                return false
            }
        }

        // Step 3: group targeting
        val groups = rules["groups"]?.jsonArray
        if (groups != null && groups.isNotEmpty()) {
            val requiredGroups = groups.map { it.jsonPrimitive.content }.toSet()
            if (context.groups.intersect(requiredGroups).isEmpty()) {
                return false
            }
        }

        // Step 4: percentage rollout — stable hash on playerId
        val percentageElement = rules["percentage"]
        if (percentageElement != null) {
            val percentage = percentageElement.jsonPrimitive.content.toIntOrNull() ?: FULL_PERCENTAGE
            val playerId = context.playerId ?: return percentage == FULL_PERCENTAGE
            val hash = abs(playerId.hashCode()) % FULL_PERCENTAGE
            if (hash >= percentage) {
                return false
            }
        }

        return true
    }

    override suspend fun findByName(name: String): FeatureFlag? =
        newSuspendedTransaction {
            FeatureFlagsTable
                .selectAll()
                .where { FeatureFlagsTable.name eq name }
                .singleOrNull()
                ?.toFeatureFlag()
        }

    override suspend fun findAll(): List<FeatureFlag> =
        newSuspendedTransaction {
            FeatureFlagsTable.selectAll().map { it.toFeatureFlag() }
        }

    override suspend fun save(flag: FeatureFlag): FeatureFlag =
        newSuspendedTransaction {
            val existing =
                FeatureFlagsTable
                    .selectAll()
                    .where { FeatureFlagsTable.id eq flag.id }
                    .singleOrNull()

            if (existing == null) {
                FeatureFlagsTable.insert {
                    it[id] = flag.id
                    it[name] = flag.name
                    it[displayName] = flag.displayName
                    it[description] = flag.description
                    it[enabled] = flag.enabled
                    it[rules] = json.encodeToString(JsonObject.serializer(), flag.rules)
                    it[updatedByStaffId] = flag.updatedByStaffId
                    it[createdAt] = OffsetDateTime.ofInstant(flag.createdAt.toJavaInstant(), ZoneOffset.UTC)
                    it[updatedAt] = OffsetDateTime.ofInstant(flag.updatedAt.toJavaInstant(), ZoneOffset.UTC)
                }
            } else {
                FeatureFlagsTable.update({ FeatureFlagsTable.id eq flag.id }) {
                    it[displayName] = flag.displayName
                    it[description] = flag.description
                    it[enabled] = flag.enabled
                    it[rules] = json.encodeToString(JsonObject.serializer(), flag.rules)
                    it[updatedByStaffId] = flag.updatedByStaffId
                    it[updatedAt] = OffsetDateTime.ofInstant(flag.updatedAt.toJavaInstant(), ZoneOffset.UTC)
                }
            }

            val saved =
                FeatureFlagsTable
                    .selectAll()
                    .where { FeatureFlagsTable.id eq flag.id }
                    .single()
                    .toFeatureFlag()

            // Invalidate cache on write
            cache.remove(saved.name)
            saved
        }

    /**
     * W-4: Pre-warms the local cache by loading every flag from the database.
     *
     * Call once at application startup so the very first [isEnabled] invocation after boot
     * does not result in a cache miss and an implicit DB round-trip.
     */
    override suspend fun warmCache() {
        findAll() // toFeatureFlag() populates the cache as a side-effect during mapping
    }

    private fun getCached(key: String): FeatureFlag? {
        val entry = cache[key]
        val now = Clock.System.now()
        return if (entry != null && (now - entry.fetchedAt).inWholeSeconds < CACHE_TTL_SECONDS) {
            entry.flag
        } else {
            null
        }
    }

    private fun ResultRow.toFeatureFlag(): FeatureFlag {
        val flag =
            FeatureFlag(
                id = this[FeatureFlagsTable.id],
                name = this[FeatureFlagsTable.name],
                displayName = this[FeatureFlagsTable.displayName],
                description = this[FeatureFlagsTable.description],
                enabled = this[FeatureFlagsTable.enabled],
                rules =
                    try {
                        json.parseToJsonElement(this[FeatureFlagsTable.rules]) as JsonObject
                    } catch (_: Exception) {
                        JsonObject(emptyMap())
                    },
                updatedByStaffId = this[FeatureFlagsTable.updatedByStaffId],
                createdAt = this[FeatureFlagsTable.createdAt].toInstant().toKotlinInstant(),
                updatedAt = this[FeatureFlagsTable.updatedAt].toInstant().toKotlinInstant(),
            )
        cache[flag.name] = CacheEntry(flag, Clock.System.now())
        return flag
    }

    private companion object {
        const val CACHE_TTL_SECONDS = 30L

        /** Represents 100% — used for percentage rollout calculations. */
        const val FULL_PERCENTAGE = 100
    }
}
