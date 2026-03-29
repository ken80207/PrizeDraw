@file:Suppress("MagicNumber")

package com.prizedraw.schema.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.json.jsonb
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/** Exposed table definition for `notifications`. */
public object NotificationsTable : Table("notifications") {
    /** Surrogate primary key. */
    public val id = uuid("id").autoGenerate()

    /** FK to the player who owns this notification. */
    public val playerId = uuid("player_id").references(PlayersTable.id)

    /** Dot-namespaced event type key, e.g. `payment.confirmed`. */
    public val eventType = varchar("event_type", 128)

    /** Short notification title shown in the notification list. */
    public val title = varchar("title", 256)

    /** Full notification body text. */
    public val body = text("body")

    /** Optional JSON key-value metadata attached to the notification. Stored as raw JSON string. */
    public val data = jsonb("data", { it }, { it }).default("{}")

    /** Whether the player has acknowledged this notification. */
    public val isRead = bool("is_read").default(false)

    /**
     * Optional deduplication key.
     *
     * When non-null, a unique index on this column prevents duplicate notifications
     * for the same logical event (e.g. re-triggered webhooks). Set at insert time;
     * never updated after creation.
     */
    public val dedupKey = varchar("dedup_key", 256).nullable()

    /** Creation timestamp. */
    public val createdAt = timestampWithTimeZone("created_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
