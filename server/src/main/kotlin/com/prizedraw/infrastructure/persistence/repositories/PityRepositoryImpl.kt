package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IPityRepository
import com.prizedraw.domain.entities.AccumulationMode
import com.prizedraw.domain.entities.PityPrizePoolEntry
import com.prizedraw.domain.entities.PityRule
import com.prizedraw.domain.entities.PityTracker
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.schema.tables.PityPrizePoolTable
import com.prizedraw.schema.tables.PityRulesTable
import com.prizedraw.schema.tables.PityTrackersTable
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** Exposed-backed implementation of [IPityRepository]. */
public class PityRepositoryImpl : IPityRepository {
    override suspend fun findRuleByCampaignId(campaignId: CampaignId): PityRule? =
        newSuspendedTransaction {
            PityRulesTable
                .selectAll()
                .where { PityRulesTable.campaignId eq campaignId.value }
                .singleOrNull()
                ?.toRule()
        }

    override suspend fun findRuleById(ruleId: UUID): PityRule? =
        newSuspendedTransaction {
            PityRulesTable
                .selectAll()
                .where { PityRulesTable.id eq ruleId }
                .singleOrNull()
                ?.toRule()
        }

    override suspend fun saveRule(rule: PityRule): PityRule =
        newSuspendedTransaction {
            val now = OffsetDateTime.now(ZoneOffset.UTC)
            val existing =
                PityRulesTable
                    .selectAll()
                    .where { PityRulesTable.id eq rule.id }
                    .singleOrNull()
            if (existing == null) {
                PityRulesTable.insert {
                    it[id] = rule.id
                    it[campaignId] = rule.campaignId.value
                    it[campaignType] = rule.campaignType
                    it[threshold] = rule.threshold
                    it[accumulationMode] = rule.accumulationMode.name
                    it[sessionTimeoutSeconds] = rule.sessionTimeoutSeconds
                    it[enabled] = rule.enabled
                    it[createdAt] = now
                    it[updatedAt] = now
                }
            } else {
                PityRulesTable.update({ PityRulesTable.id eq rule.id }) {
                    it[threshold] = rule.threshold
                    it[accumulationMode] = rule.accumulationMode.name
                    it[sessionTimeoutSeconds] = rule.sessionTimeoutSeconds
                    it[enabled] = rule.enabled
                    it[updatedAt] = now
                }
            }
            PityRulesTable
                .selectAll()
                .where { PityRulesTable.id eq rule.id }
                .single()
                .toRule()
        }

    override suspend fun deleteRule(ruleId: UUID): Unit =
        newSuspendedTransaction {
            PityRulesTable.deleteWhere { PityRulesTable.id eq ruleId }
        }

    override suspend fun findPoolByRuleId(ruleId: UUID): List<PityPrizePoolEntry> =
        newSuspendedTransaction {
            PityPrizePoolTable
                .selectAll()
                .where { PityPrizePoolTable.pityRuleId eq ruleId }
                .map { it.toPoolEntry() }
        }

    override suspend fun replacePool(
        ruleId: UUID,
        entries: List<PityPrizePoolEntry>,
    ): Unit =
        newSuspendedTransaction {
            PityPrizePoolTable.deleteWhere { PityPrizePoolTable.pityRuleId eq ruleId }
            entries.forEach { entry ->
                PityPrizePoolTable.insert {
                    it[id] = entry.id
                    it[pityRuleId] = ruleId
                    it[prizeDefinitionId] = entry.prizeDefinitionId.value
                    it[weight] = entry.weight
                }
            }
        }

    override suspend fun findTracker(
        ruleId: UUID,
        playerId: PlayerId,
    ): PityTracker? =
        newSuspendedTransaction {
            PityTrackersTable
                .selectAll()
                .where {
                    (PityTrackersTable.pityRuleId eq ruleId) and
                        (PityTrackersTable.playerId eq playerId.value)
                }.singleOrNull()
                ?.toTracker()
        }

    override suspend fun saveTracker(tracker: PityTracker): Boolean =
        newSuspendedTransaction {
            val now = OffsetDateTime.now(ZoneOffset.UTC)
            val existing =
                PityTrackersTable
                    .selectAll()
                    .where {
                        (PityTrackersTable.pityRuleId eq tracker.pityRuleId) and
                            (PityTrackersTable.playerId eq tracker.playerId.value)
                    }.singleOrNull()
            if (existing == null) {
                PityTrackersTable.insert {
                    it[id] = tracker.id
                    it[pityRuleId] = tracker.pityRuleId
                    it[playerId] = tracker.playerId.value
                    it[drawCount] = tracker.drawCount
                    it[lastDrawAt] =
                        tracker.lastDrawAt?.let { ts ->
                            OffsetDateTime.ofInstant(
                                java.time.Instant.ofEpochSecond(ts.epochSeconds, ts.nanosecondsOfSecond.toLong()),
                                ZoneOffset.UTC,
                            )
                        }
                    it[version] = 0
                    it[createdAt] = now
                    it[updatedAt] = now
                }
                true
            } else {
                val updated =
                    PityTrackersTable.update({
                        (PityTrackersTable.pityRuleId eq tracker.pityRuleId) and
                            (PityTrackersTable.playerId eq tracker.playerId.value) and
                            (PityTrackersTable.version eq tracker.version)
                    }) {
                        it[drawCount] = tracker.drawCount
                        it[lastDrawAt] =
                            tracker.lastDrawAt?.let { ts ->
                                OffsetDateTime.ofInstant(
                                    java.time.Instant.ofEpochSecond(ts.epochSeconds, ts.nanosecondsOfSecond.toLong()),
                                    ZoneOffset.UTC,
                                )
                            }
                        it[version] = tracker.version + 1
                        it[updatedAt] = now
                    }
                updated > 0
            }
        }

    private fun ResultRow.toRule(): PityRule =
        PityRule(
            id = this[PityRulesTable.id],
            campaignId = CampaignId(this[PityRulesTable.campaignId]),
            campaignType = this[PityRulesTable.campaignType],
            threshold = this[PityRulesTable.threshold],
            accumulationMode = AccumulationMode.valueOf(this[PityRulesTable.accumulationMode]),
            sessionTimeoutSeconds = this[PityRulesTable.sessionTimeoutSeconds],
            enabled = this[PityRulesTable.enabled],
            createdAt = this[PityRulesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PityRulesTable.updatedAt].toInstant().toKotlinInstant(),
        )

    private fun ResultRow.toPoolEntry(): PityPrizePoolEntry =
        PityPrizePoolEntry(
            id = this[PityPrizePoolTable.id],
            pityRuleId = this[PityPrizePoolTable.pityRuleId],
            prizeDefinitionId = PrizeDefinitionId(this[PityPrizePoolTable.prizeDefinitionId]),
            weight = this[PityPrizePoolTable.weight],
        )

    private fun ResultRow.toTracker(): PityTracker =
        PityTracker(
            id = this[PityTrackersTable.id],
            pityRuleId = this[PityTrackersTable.pityRuleId],
            playerId = PlayerId(this[PityTrackersTable.playerId]),
            drawCount = this[PityTrackersTable.drawCount],
            lastDrawAt = this[PityTrackersTable.lastDrawAt]?.toInstant()?.toKotlinInstant(),
            version = this[PityTrackersTable.version],
            createdAt = this[PityTrackersTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PityTrackersTable.updatedAt].toInstant().toKotlinInstant(),
        )
}
