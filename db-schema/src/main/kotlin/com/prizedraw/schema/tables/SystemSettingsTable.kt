@file:Suppress("MagicNumber")

package com.prizedraw.schema.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definition for the `system_settings` table.
 *
 * Stores system-level configuration key/value pairs. Values are persisted as plain `text`
 * (containing JSON primitives such as numbers or booleans) for portability.
 * [updatedBy] references the staff member who last modified the setting.
 */
public object SystemSettingsTable : Table("system_settings") {
    /** Natural primary key — well-known setting name, e.g. `margin_threshold_pct`. */
    public val key = varchar("key", 128)

    /** JSON-encoded primitive value (number, boolean, or quoted string). */
    public val value = text("value")

    /** Timestamp of the last modification. */
    public val updatedAt = timestampWithTimeZone("updated_at").nullable()

    /** FK to the staff member who last updated this setting. Null for system-initiated changes. */
    public val updatedBy = uuid("updated_by").nullable()

    override val primaryKey: PrimaryKey = PrimaryKey(key)
}
