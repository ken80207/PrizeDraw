@file:Suppress("MagicNumber")

package com.prizedraw.schema.tables

import com.prizedraw.contracts.enums.StaffRole
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definition for the `staff` table.
 *
 * Staff authenticate via email + bcrypt password (distinct from player OAuth).
 * The `role` column maps to the `staff_role` PG enum via [pgEnum].
 */
public object StaffTable : Table("staff") {
    public val id = uuid("id").autoGenerate()
    public val name = varchar("name", 128)
    public val email = varchar("email", 255)
    public val hashedPassword = varchar("hashed_password", 255)
    public val role = pgEnum<StaffRole>("role", "staff_role")
    public val isActive = bool("is_active").default(true)
    public val lastLoginAt = timestampWithTimeZone("last_login_at").nullable()
    public val createdByStaffId = uuid("created_by_staff_id").nullable()
    public val deletedAt = timestampWithTimeZone("deleted_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
