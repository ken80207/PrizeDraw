package com.prizedraw.domain.entities

import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A reusable grade preset that can be applied to campaigns.
 *
 * Templates are copied (not linked) to campaigns — modifying a template
 * does not affect campaigns that previously applied it.
 *
 * @property id Surrogate primary key.
 * @property name Template display name, e.g. "動漫風", "遊戲卡牌風".
 * @property createdByStaffId Staff member who created this template.
 * @property items Ordered list of grade tiers within this template.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class GradeTemplate(
    val id: UUID,
    val name: String,
    val createdByStaffId: UUID,
    val items: List<GradeTemplateItem>,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/**
 * A single tier within a [GradeTemplate].
 *
 * @property id Surrogate primary key.
 * @property templateId FK to the parent [GradeTemplate].
 * @property name Grade display name, e.g. "超神", "SSR".
 * @property displayOrder Rendering order (lower = rarer).
 * @property colorCode Primary text color as hex, e.g. "#FFD700".
 * @property bgColorCode Background color as hex, e.g. "#FFF8E1".
 */
public data class GradeTemplateItem(
    val id: UUID,
    val templateId: UUID,
    val name: String,
    val displayOrder: Int,
    val colorCode: String,
    val bgColorCode: String,
)
