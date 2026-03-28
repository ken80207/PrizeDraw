package com.prizedraw.contracts.dto.grade

import kotlinx.serialization.Serializable

// --- Grade Template DTOs ---

@Serializable
public data class GradeTemplateDto(
    val id: String,
    val name: String,
    val createdByStaffName: String? = null,
    val items: List<GradeTemplateItemDto>,
)

@Serializable
public data class GradeTemplateItemDto(
    val id: String,
    val name: String,
    val displayOrder: Int,
    val colorCode: String,
    val bgColorCode: String,
)

@Serializable
public data class CreateGradeTemplateRequest(
    val name: String,
    val items: List<GradeTemplateItemRequest>,
)

@Serializable
public data class UpdateGradeTemplateRequest(
    val name: String,
    val items: List<GradeTemplateItemRequest>,
)

@Serializable
public data class GradeTemplateItemRequest(
    val name: String,
    val displayOrder: Int,
    val colorCode: String,
    val bgColorCode: String,
)

// --- Campaign Grade DTOs ---

@Serializable
public data class CampaignGradeDto(
    val id: String,
    val name: String,
    val displayOrder: Int,
    val colorCode: String,
    val bgColorCode: String,
)

@Serializable
public data class ApplyGradeTemplateRequest(
    val templateId: String,
    val mode: ApplyMode = ApplyMode.REPLACE,
)

@Serializable
public enum class ApplyMode {
    REPLACE,
    MERGE,
}

@Serializable
public data class UpsertCampaignGradeRequest(
    val id: String? = null,
    val name: String,
    val displayOrder: Int,
    val colorCode: String,
    val bgColorCode: String,
)

@Serializable
public data class BatchUpdateCampaignGradesRequest(
    val grades: List<UpsertCampaignGradeRequest>,
)
