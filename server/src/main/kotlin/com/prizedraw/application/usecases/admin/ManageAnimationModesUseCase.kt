package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.IManageAnimationModesUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IFeatureFlagRepository
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.FeatureFlag
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/**
 * Toggles individual draw animation modes on or off using feature flags.
 *
 * Each mode is stored as a feature flag keyed `animation_mode_{mode.lowercase()}`,
 * e.g. `animation_mode_tear`. Disabling a mode causes clients to fall back to INSTANT.
 */
public class ManageAnimationModesUseCase(
    private val featureFlagRepository: IFeatureFlagRepository,
    private val auditRepository: IAuditRepository,
) : IManageAnimationModesUseCase {
    override suspend fun setModeEnabled(
        staffId: StaffId,
        mode: DrawAnimationMode,
        enabled: Boolean,
    ): Map<DrawAnimationMode, Boolean> {
        val key = mode.toFlagKey()
        val now = Clock.System.now()
        val existing = featureFlagRepository.findByName(key)
        val previousEnabled = existing?.enabled ?: false

        val flag =
            existing?.copy(enabled = enabled, updatedByStaffId = staffId.value, updatedAt = now)
                ?: FeatureFlag(
                    id = UUID.randomUUID(),
                    name = key,
                    displayName = "Animation Mode: ${mode.name}",
                    description = "Enables the ${mode.name} draw animation. Disable to force INSTANT fallback.",
                    enabled = enabled,
                    rules = kotlinx.serialization.json.buildJsonObject {},
                    updatedByStaffId = staffId.value,
                    createdAt = now,
                    updatedAt = now,
                )

        featureFlagRepository.save(flag)
        recordAudit(staffId, mode, previousEnabled, enabled, now)
        return getAllModeStates()
    }

    override suspend fun getAllModeStates(): Map<DrawAnimationMode, Boolean> =
        DrawAnimationMode.entries.associateWith { mode ->
            featureFlagRepository.isEnabled(mode.toFlagKey())
        }

    private fun recordAudit(
        staffId: StaffId,
        mode: DrawAnimationMode,
        previousEnabled: Boolean,
        newEnabled: Boolean,
        now: kotlinx.datetime.Instant,
    ) {
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = staffId.value,
                action = "animation.mode.toggled",
                entityType = "FeatureFlag",
                entityId = null,
                beforeValue =
                    buildJsonObject {
                        put("mode", mode.name)
                        put("enabled", previousEnabled)
                    },
                afterValue =
                    buildJsonObject {
                        put("mode", mode.name)
                        put("enabled", newEnabled)
                    },
                metadata = buildJsonObject { put("staffId", staffId.value.toString()) },
                createdAt = now,
            ),
        )
    }
}

/** Converts a [DrawAnimationMode] to its feature flag key. */
public fun DrawAnimationMode.toFlagKey(): String = "animation_mode_${name.lowercase()}"
