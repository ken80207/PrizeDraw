@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.persistence.tables

import com.prizedraw.domain.entities.AuditActorType
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.json.jsonb
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definitions for audit, outbox, and refresh token families.
 *
 * [AuditLogsTable] is append-only and covers the compliance audit trail.
 * [AuditLogsTable.actorType] maps to the `audit_actor_type` PG enum using the domain-layer
 * [AuditActorType] enum, which is what the repository imports.
 *
 * [OutboxEventsTable] implements the transactional outbox pattern. Note that
 * `outbox_events.status` is a plain `VARCHAR(32)` in the DB schema (not a PG enum),
 * so it remains mapped as [varchar].
 *
 * [RefreshTokenFamiliesTable] supports JWT rotation with family-level revocation.
 */
public object AuditLogsTable : Table("audit_logs") {
    public val id = uuid("id").autoGenerate()
    public val actorType = pgEnum<AuditActorType>("actor_type", "audit_actor_type")
    public val actorPlayerId = uuid("actor_player_id").nullable()
    public val actorStaffId = uuid("actor_staff_id").nullable()
    public val action = varchar("action", 128)
    public val entityType = varchar("entity_type", 64)
    public val entityId = uuid("entity_id").nullable()
    public val beforeValue = jsonb("before_value", { it }, { it }).nullable()
    public val afterValue = jsonb("after_value", { it }, { it }).nullable()
    public val metadata = jsonb("metadata", { it }, { it })
    public val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object OutboxEventsTable : Table("outbox_events") {
    public val id = uuid("id").autoGenerate()
    public val eventType = varchar("event_type", 128)
    public val aggregateId = uuid("aggregate_id")
    public val payload = jsonb("payload", { it }, { it })

    /** Plain `VARCHAR(32)` in the DB — not a PG enum, kept as varchar intentionally. */
    public val status = varchar("status", 32).default("PENDING")
    public val attempts = integer("attempts").default(0)
    public val lastError = text("last_error").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val processedAt = timestampWithTimeZone("processed_at").nullable()

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object RefreshTokenFamiliesTable : Table("refresh_token_families") {
    public val id = uuid("id").autoGenerate()
    public val playerId = uuid("player_id")
    public val familyToken = varchar("family_token", 64)
    public val currentTokenHash = varchar("current_token_hash", 128)
    public val revoked = bool("revoked").default(false)
    public val revokedAt = timestampWithTimeZone("revoked_at").nullable()

    // Hard expiry for the token family — added by V013 migration.
    public val expiresAt = timestampWithTimeZone("expires_at")

    // Actor type for this session: PLAYER or STAFF — added by V013 migration.
    public val actorType = varchar("actor_type", 16).default("PLAYER")

    // FK to the staff member who owns this family, null for player sessions — added by V013 migration.
    public val staffId = uuid("staff_id").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
