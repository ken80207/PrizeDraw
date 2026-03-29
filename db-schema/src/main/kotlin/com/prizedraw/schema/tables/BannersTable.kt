package com.prizedraw.schema.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

@Suppress("MagicNumber")
public object BannersTable : Table("banners") {
    public val id = uuid("id").autoGenerate()
    public val imageUrl = text("image_url")
    public val linkType = varchar("link_type", 20).nullable()
    public val linkUrl = text("link_url").nullable()
    public val sortOrder = integer("sort_order").default(0)
    public val isActive = bool("is_active").default(true)
    public val scheduledStart = timestampWithTimeZone("scheduled_start").nullable()
    public val scheduledEnd = timestampWithTimeZone("scheduled_end").nullable()
    public val createdBy = uuid("created_by")
    public val updatedBy = uuid("updated_by").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
