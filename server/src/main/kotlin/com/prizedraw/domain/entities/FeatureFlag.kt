package com.prizedraw.domain.entities

import kotlinx.datetime.Instant
import kotlinx.serialization.json.JsonObject
import java.util.UUID

/**
 * A runtime feature toggle managed by administrators (功能開關).
 *
 * Supports four control dimensions: global on/off, group-based (player segment),
 * platform-based (Android/iOS/Web), and percentage-based rollout. No code deployment
 * is required to change a flag's state.
 *
 * The [rules] JSON object encodes targeting configuration evaluated when [enabled] is true.
 * Every change to a FeatureFlag must produce an [AuditLog] entry.
 *
 * Known flag names defined by the platform spec:
 * - `exchange_feature` — player-to-player prize exchange
 * - `leaderboard` — public leaderboards
 * - `coupon_system` — coupon and discount code usage
 * - `animation_options` — player animation mode selection
 * - `spectator_mode` — live kuji draw spectating
 * - `line_cs_channel` — LINE Official Account CS integration
 *
 * @property id Surrogate primary key.
 * @property name Stable machine-readable key in `snake_case`. Immutable after creation.
 * @property displayName Human-readable label for the admin UI.
 * @property description Intent and impact of this flag.
 * @property enabled Global master switch. When false, the feature is OFF for all.
 * @property rules Structured targeting rules evaluated when [enabled] is true.
 * @property updatedByStaffId FK to the Staff member who last modified this flag.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class FeatureFlag(
    val id: UUID,
    val name: String,
    val displayName: String,
    val description: String?,
    val enabled: Boolean,
    val rules: JsonObject,
    val updatedByStaffId: UUID?,
    val createdAt: Instant,
    val updatedAt: Instant,
)
