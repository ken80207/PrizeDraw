package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definition for the `server_announcements` table.
 *
 * Stores platform-wide announcements used to communicate maintenance windows,
 * informational notices, and forced app-update requirements to all clients.
 *
 * The `target_platforms` column is a PostgreSQL text array. Exposed maps this
 * via [array] using a plain String element type.
 */
@Suppress("MagicNumber")
public object ServerAnnouncementTable : Table("server_announcements") {
    public val id = uuid("id").autoGenerate()
    public val type = varchar("type", 32)
    public val title = text("title")
    public val message = text("message")
    public val isActive = bool("is_active").default(true)
    public val isBlocking = bool("is_blocking").default(false)
    public val targetPlatforms = array<String>("target_platforms").default(emptyList())
    public val minAppVersion = varchar("min_app_version", 32).nullable()
    public val scheduledStart = timestampWithTimeZone("scheduled_start").nullable()
    public val scheduledEnd = timestampWithTimeZone("scheduled_end").nullable()
    public val createdByStaffId = uuid("created_by_staff_id").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
