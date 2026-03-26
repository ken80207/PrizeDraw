@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definition for the `players` table.
 *
 * PostgreSQL enum columns (`oauth_provider`, `preferred_animation_mode`) are mapped as
 * `varchar` and converted to/from Kotlin enum values in the repository layer, which is
 * simpler and more reliable than `customEnumeration` with the JDBC driver.
 */
public object PlayersTable : Table("players") {
    public val id = uuid("id").autoGenerate()
    public val nickname = varchar("nickname", 64)
    public val avatarUrl = text("avatar_url").nullable()
    public val phoneNumber = varchar("phone_number", 20).nullable()
    public val phoneVerifiedAt = timestampWithTimeZone("phone_verified_at").nullable()
    public val oauthProvider = varchar("oauth_provider", 32)
    public val oauthSubject = varchar("oauth_subject", 255)
    public val drawPointsBalance = integer("draw_points_balance").default(0)
    public val revenuePointsBalance = integer("revenue_points_balance").default(0)
    public val version = integer("version").default(0)
    public val xp = integer("xp").default(0)
    public val level = integer("level").default(1)
    public val tier = varchar("tier", 32).default("BRONZE")
    public val preferredAnimationMode = varchar("preferred_animation_mode", 32).default("TEAR")
    public val locale = varchar("locale", 10).default("zh-TW")
    public val isActive = bool("is_active").default(true)
    public val deletedAt = timestampWithTimeZone("deleted_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
