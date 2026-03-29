package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.ISystemSettingsRepository
import com.prizedraw.schema.tables.SystemSettingsTable
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.upsert
import java.math.BigDecimal
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

private const val KEY_MARGIN_THRESHOLD_PCT = "margin_threshold_pct"
private const val KEY_REQUIRE_APPROVAL_BELOW_THRESHOLD = "require_approval_below_threshold"
private const val DEFAULT_MARGIN_THRESHOLD_PCT = "30.00"
private const val DEFAULT_REQUIRE_APPROVAL_BELOW_THRESHOLD = "false"

/**
 * Exposed-backed implementation of [ISystemSettingsRepository].
 *
 * Reads and writes rows in `system_settings` using upsert semantics so that
 * the table can be seeded lazily — a missing row falls back to a sensible default.
 */
public class SystemSettingsRepositoryImpl : ISystemSettingsRepository {
    override suspend fun getMarginThresholdPct(): BigDecimal =
        newSuspendedTransaction {
            val raw =
                SystemSettingsTable
                    .selectAll()
                    .where { SystemSettingsTable.key eq KEY_MARGIN_THRESHOLD_PCT }
                    .singleOrNull()
                    ?.get(SystemSettingsTable.value)
                    ?: DEFAULT_MARGIN_THRESHOLD_PCT
            BigDecimal(raw)
        }

    override suspend fun getRequireApprovalBelowThreshold(): Boolean =
        newSuspendedTransaction {
            val raw =
                SystemSettingsTable
                    .selectAll()
                    .where { SystemSettingsTable.key eq KEY_REQUIRE_APPROVAL_BELOW_THRESHOLD }
                    .singleOrNull()
                    ?.get(SystemSettingsTable.value)
                    ?: DEFAULT_REQUIRE_APPROVAL_BELOW_THRESHOLD
            raw.toBooleanStrict()
        }

    override suspend fun updateMarginThresholdPct(
        value: BigDecimal,
        staffId: UUID,
    ): Unit =
        newSuspendedTransaction {
            SystemSettingsTable.upsert {
                it[key] = KEY_MARGIN_THRESHOLD_PCT
                it[SystemSettingsTable.value] = value.toPlainString()
                it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
                it[updatedBy] = staffId
            }
        }

    override suspend fun updateRequireApprovalBelowThreshold(
        value: Boolean,
        staffId: UUID,
    ): Unit =
        newSuspendedTransaction {
            SystemSettingsTable.upsert {
                it[key] = KEY_REQUIRE_APPROVAL_BELOW_THRESHOLD
                it[SystemSettingsTable.value] = value.toString()
                it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
                it[updatedBy] = staffId
            }
        }
}
