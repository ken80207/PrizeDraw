package com.prizedraw.infrastructure.persistence.tables

import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definitions for the prize grade system.
 *
 * [GradeTemplatesTable] stores reusable grade presets.
 * [GradeTemplateItemsTable] stores individual tiers within a template.
 * [CampaignGradesTable] stores per-campaign grade definitions (copied from templates).
 */
private const val TEMPLATE_NAME_MAX_LENGTH = 100
private const val GRADE_NAME_MAX_LENGTH = 50
private const val COLOR_CODE_MAX_LENGTH = 9

public object GradeTemplatesTable : Table("grade_templates") {
    public val id = uuid("id").autoGenerate()
    public val name = varchar("name", TEMPLATE_NAME_MAX_LENGTH)
    public val createdBy = uuid("created_by")
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object GradeTemplateItemsTable : Table("grade_template_items") {
    public val id = uuid("id").autoGenerate()
    public val templateId = uuid("template_id").references(GradeTemplatesTable.id)
    public val name = varchar("name", GRADE_NAME_MAX_LENGTH)
    public val displayOrder = integer("display_order")
    public val colorCode = varchar("color_code", COLOR_CODE_MAX_LENGTH)
    public val bgColorCode = varchar("bg_color_code", COLOR_CODE_MAX_LENGTH)
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object CampaignGradesTable : Table("campaign_grades") {
    public val id = uuid("id").autoGenerate()
    public val kujiCampaignId = uuid("kuji_campaign_id").nullable()
    public val unlimitedCampaignId = uuid("unlimited_campaign_id").nullable()
    public val name = varchar("name", GRADE_NAME_MAX_LENGTH)
    public val displayOrder = integer("display_order")
    public val colorCode = varchar("color_code", COLOR_CODE_MAX_LENGTH)
    public val bgColorCode = varchar("bg_color_code", COLOR_CODE_MAX_LENGTH)
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
