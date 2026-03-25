package com.prizedraw.domain.entities

import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Instant
import kotlinx.serialization.json.JsonObject
import java.util.UUID

/**
 * Actor classification for an [AuditLog] entry.
 */
public enum class AuditActorType {
    /** Action initiated by a player. */
    PLAYER,

    /** Action initiated by a staff member. */
    STAFF,

    /** Action initiated by an automated system process. */
    SYSTEM,
}

/**
 * Append-only log of all significant system events (操作紀錄).
 *
 * Records staff back-office operations and player key actions. Stores a structured JSON
 * snapshot of the entity state before and after the mutation for forensic replay.
 *
 * Records are INSERT-only; no UPDATE or DELETE operations are permitted.
 * Retained indefinitely for compliance.
 *
 * @property id Surrogate primary key.
 * @property actorType Classification of who performed this action.
 * @property actorPlayerId FK to the acting [Player]. Non-null only when [actorType] is PLAYER.
 * @property actorStaffId FK to the acting Staff. Non-null only when [actorType] is STAFF.
 * @property action Dot-namespaced action key, e.g. `campaign.kuji.activated`.
 * @property entityType Target entity name, e.g. `KujiCampaign`, `Player`.
 * @property entityId Target entity primary key. Null for collection-level actions.
 * @property beforeValue Entity state snapshot before the mutation. Null for creation events.
 * @property afterValue Entity state snapshot after the mutation. Null for pure read events.
 * @property metadata Additional context (IP address, user agent, session ID, request ID).
 * @property createdAt Immutable event timestamp.
 */
public data class AuditLog(
    val id: UUID,
    val actorType: AuditActorType,
    val actorPlayerId: PlayerId?,
    val actorStaffId: UUID?,
    val action: String,
    val entityType: String,
    val entityId: UUID?,
    val beforeValue: JsonObject?,
    val afterValue: JsonObject?,
    val metadata: JsonObject,
    val createdAt: Instant,
)
