@file:Suppress("MagicNumber")

package com.prizedraw.schema.tables

import com.prizedraw.contracts.enums.QueueEntryStatus
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definitions for the kuji draw queue subsystem.
 *
 * One [QueuesTable] row per [TicketBoxesTable] row. [QueueEntriesTable] tracks the ordered
 * waiting list within a queue, using the `queue_entry_status` PG enum.
 */
public object QueuesTable : Table("queues") {
    public val id = uuid("id").autoGenerate()
    public val ticketBoxId = uuid("ticket_box_id")
    public val activePlayerId = uuid("active_player_id").nullable()
    public val sessionStartedAt = timestampWithTimeZone("session_started_at").nullable()
    public val sessionExpiresAt = timestampWithTimeZone("session_expires_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object QueueEntriesTable : Table("queue_entries") {
    public val id = uuid("id").autoGenerate()
    public val queueId = uuid("queue_id")
    public val playerId = uuid("player_id")
    public val position = integer("position")
    public val status =
        pgEnum<QueueEntryStatus>("status", "queue_entry_status")
            .default(QueueEntryStatus.WAITING)
    public val joinedAt = timestampWithTimeZone("joined_at")
    public val activatedAt = timestampWithTimeZone("activated_at").nullable()
    public val completedAt = timestampWithTimeZone("completed_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
