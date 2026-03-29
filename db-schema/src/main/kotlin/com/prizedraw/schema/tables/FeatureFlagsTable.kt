@file:Suppress("MagicNumber")

package com.prizedraw.schema.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.json.jsonb
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definition for the `feature_flags` table.
 *
 * Stores runtime toggles with structured targeting rules as `jsonb`.
 */
public object FeatureFlagsTable : Table("feature_flags") {
    public val id = uuid("id").autoGenerate()
    public val name = varchar("name", 128)
    public val displayName = varchar("display_name", 255)
    public val description = text("description").nullable()
    public val enabled = bool("enabled").default(false)
    public val rules = jsonb("rules", { it }, { it })
    public val updatedByStaffId = uuid("updated_by_staff_id").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
