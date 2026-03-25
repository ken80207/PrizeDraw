package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.IUpdateTradeFeeRateUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IFeatureFlagRepository
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.FeatureFlag
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.util.UUID

private const val MAX_FEE_RATE_BPS = 10_000

/**
 * Updates the global trade fee rate stored as a [FeatureFlag] keyed [TRADE_FEE_RATE_CONFIG_KEY].
 *
 * The rate integer is stored in the flag's `rules` JSON as `{"value": <bps>}`.
 * Changes take effect immediately for new trade orders (via fee flag lookup).
 * Records a before/after [AuditLog] entry.
 *
 * Validates [tradeFeeRateBps] is in the range [0, 10000].
 */
public class UpdateTradeFeeRateUseCase(
    private val featureFlagRepository: IFeatureFlagRepository,
    private val auditRepository: IAuditRepository,
) : IUpdateTradeFeeRateUseCase {
    override suspend fun execute(
        staffId: StaffId,
        tradeFeeRateBps: Int,
    ): Int {
        if (tradeFeeRateBps < 0 || tradeFeeRateBps > MAX_FEE_RATE_BPS) {
            throw InvalidTradeFeeRateException(tradeFeeRateBps)
        }

        val now = Clock.System.now()
        val existing = featureFlagRepository.findByName(TRADE_FEE_RATE_CONFIG_KEY)
        val previousRate =
            existing
                ?.rules
                ?.get("value")
                ?.jsonPrimitive
                ?.int ?: 0
        val newRules = JsonObject(mapOf("value" to JsonPrimitive(tradeFeeRateBps)))

        val flag =
            existing?.copy(
                rules = newRules,
                updatedByStaffId = staffId.value,
                updatedAt = now,
            ) ?: FeatureFlag(
                id = UUID.randomUUID(),
                name = TRADE_FEE_RATE_CONFIG_KEY,
                displayName = "Trade Fee Rate (bps)",
                description = "Platform fee rate applied to trade marketplace transactions. Stored as basis points.",
                enabled = true,
                rules = newRules,
                updatedByStaffId = staffId.value,
                createdAt = now,
                updatedAt = now,
            )

        featureFlagRepository.save(flag)
        recordAudit(staffId, previousRate, tradeFeeRateBps, now)
        return tradeFeeRateBps
    }

    private fun recordAudit(
        staffId: StaffId,
        previousRate: Int,
        newRate: Int,
        now: kotlinx.datetime.Instant,
    ) {
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = staffId.value,
                action = "platform.tradeFeeRate.updated",
                entityType = "PlatformConfig",
                entityId = null,
                beforeValue = buildJsonObject { put("tradeFeeRateBps", previousRate) },
                afterValue = buildJsonObject { put("tradeFeeRateBps", newRate) },
                metadata = buildJsonObject { put("staffId", staffId.value.toString()) },
                createdAt = now,
            ),
        )
    }
}
