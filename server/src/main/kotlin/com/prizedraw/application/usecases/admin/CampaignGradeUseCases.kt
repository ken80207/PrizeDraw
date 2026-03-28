package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.output.ICampaignGradeRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IGradeTemplateRepository
import com.prizedraw.contracts.dto.grade.ApplyMode
import com.prizedraw.domain.entities.CampaignGrade
import com.prizedraw.domain.valueobjects.CampaignGradeId
import com.prizedraw.domain.valueobjects.CampaignId
import kotlinx.datetime.Clock
import java.util.UUID

private val colorCodeRegex = Regex("^#[0-9A-Fa-f]{6,8}$")

/**
 * Application-layer use cases for managing campaign-scoped [CampaignGrade] entries.
 *
 * @property campaignRepository Used to determine campaign type (kuji vs unlimited).
 * @property campaignGradeRepository Output port for campaign grade persistence.
 * @property gradeTemplateRepository Used to look up templates during [applyTemplate].
 */
public class CampaignGradeUseCases(
    private val campaignRepository: ICampaignRepository,
    private val campaignGradeRepository: ICampaignGradeRepository,
    private val gradeTemplateRepository: IGradeTemplateRepository,
) {
    /**
     * A single grade supplied by the caller during a batch update.
     *
     * @property id When non-null, indicates an existing grade that should be preserved (if still present).
     *              When null, a new grade is created.
     */
    public data class GradeInput(
        val id: String?,
        val name: String,
        val displayOrder: Int,
        val colorCode: String,
        val bgColorCode: String,
    )

    /**
     * Returns all grades for a campaign, ordered by [CampaignGrade.displayOrder].
     *
     * @param campaignId The campaign's unique identifier.
     */
    public suspend fun listGrades(campaignId: CampaignId): List<CampaignGrade> =
        campaignGradeRepository.findByCampaignId(campaignId)

    /**
     * Copies grade tiers from a template to a campaign.
     *
     * - [ApplyMode.REPLACE]: Checks that all existing grades have zero prize references, then
     *   replaces all grades with copies of the template items.
     * - [ApplyMode.MERGE]: Retains existing grades and appends only new template items
     *   (matched by name) with incremented display orders.
     *
     * @param campaignId Target campaign.
     * @param templateId Source template.
     * @param mode Whether to replace or merge existing grades.
     * @return The resulting list of campaign grades.
     * @throws IllegalArgumentException if the template is not found.
     * @throws IllegalStateException if REPLACE mode is blocked by existing prize references.
     */
    public suspend fun applyTemplate(
        campaignId: CampaignId,
        templateId: UUID,
        mode: ApplyMode,
    ): List<CampaignGrade> {
        val template =
            gradeTemplateRepository.findById(templateId)
                ?: throw IllegalArgumentException("Grade template not found: $templateId")

        val isKuji = campaignRepository.findKujiById(campaignId) != null
        val now = Clock.System.now()

        return when (mode) {
            ApplyMode.REPLACE -> {
                val existing = campaignGradeRepository.findByCampaignId(campaignId)
                for (grade in existing) {
                    val refs = campaignGradeRepository.countPrizeReferences(grade.id)
                    check(refs == 0L) {
                        "Cannot replace grades — grade '${grade.name}' (${grade.id}) has $refs prize reference(s)"
                    }
                }

                val newGrades =
                    template.items.map { item ->
                        buildCampaignGrade(
                            campaignId = campaignId,
                            isKuji = isKuji,
                            name = item.name,
                            displayOrder = item.displayOrder,
                            colorCode = item.colorCode,
                            bgColorCode = item.bgColorCode,
                            now = now,
                        )
                    }

                campaignGradeRepository.replaceAll(campaignId, newGrades)
            }

            ApplyMode.MERGE -> {
                val existing = campaignGradeRepository.findByCampaignId(campaignId)
                val existingNames = existing.map { it.name }.toSet()
                val maxOrder = existing.maxOfOrNull { it.displayOrder } ?: -1

                var nextOrder = maxOrder + 1
                val toAdd =
                    template.items
                        .filter { it.name !in existingNames }
                        .map { item ->
                            buildCampaignGrade(
                                campaignId = campaignId,
                                isKuji = isKuji,
                                name = item.name,
                                displayOrder = nextOrder++,
                                colorCode = item.colorCode,
                                bgColorCode = item.bgColorCode,
                                now = now,
                            )
                        }

                if (toAdd.isNotEmpty()) {
                    campaignGradeRepository.saveAll(toAdd)
                }

                campaignGradeRepository.findByCampaignId(campaignId)
            }
        }
    }

    /**
     * Replaces all grades for a campaign in a single atomic operation.
     *
     * Validates:
     * - [grades] must not be empty.
     * - All color codes must match `^#[0-9A-Fa-f]{6,8}$`.
     * - Any existing grades being removed must have zero prize references.
     *
     * @param campaignId Target campaign.
     * @param grades New set of grades to apply.
     * @return The resulting list of campaign grades.
     * @throws IllegalArgumentException if validation fails.
     * @throws IllegalStateException if a grade to be removed has prize references.
     */
    public suspend fun batchUpdate(
        campaignId: CampaignId,
        grades: List<GradeInput>,
    ): List<CampaignGrade> {
        require(grades.isNotEmpty()) { "grades must not be empty" }
        validateGradeColors(grades)

        val isKuji = campaignRepository.findKujiById(campaignId) != null
        val now = Clock.System.now()

        // Check that any existing grades being removed have no prize references
        val existing = campaignGradeRepository.findByCampaignId(campaignId)
        val incomingIds = grades.mapNotNull { it.id }.toSet()
        val beingRemoved = existing.filter { it.id.value.toString() !in incomingIds }

        for (grade in beingRemoved) {
            val refs = campaignGradeRepository.countPrizeReferences(grade.id)
            check(refs == 0L) {
                "Cannot remove grade '${grade.name}' (${grade.id}) — it has $refs prize reference(s)"
            }
        }

        val newGrades =
            grades.map { input ->
                val gradeId =
                    if (input.id != null) {
                        CampaignGradeId(UUID.fromString(input.id))
                    } else {
                        CampaignGradeId.generate()
                    }
                buildCampaignGrade(
                    campaignId = campaignId,
                    isKuji = isKuji,
                    gradeId = gradeId,
                    name = input.name,
                    displayOrder = input.displayOrder,
                    colorCode = input.colorCode,
                    bgColorCode = input.bgColorCode,
                    now = now,
                )
            }

        return campaignGradeRepository.replaceAll(campaignId, newGrades)
    }

    // --- Private helpers ---

    private fun buildCampaignGrade(
        campaignId: CampaignId,
        isKuji: Boolean,
        gradeId: CampaignGradeId = CampaignGradeId.generate(),
        name: String,
        displayOrder: Int,
        colorCode: String,
        bgColorCode: String,
        now: kotlinx.datetime.Instant,
    ): CampaignGrade {
        val kujiCampaignId =
            if (isKuji) {
                campaignId
            } else {
                null
            }
        val unlimitedCampaignId =
            if (!isKuji) {
                campaignId
            } else {
                null
            }
        return CampaignGrade(
            id = gradeId,
            kujiCampaignId = kujiCampaignId,
            unlimitedCampaignId = unlimitedCampaignId,
            name = name.trim(),
            displayOrder = displayOrder,
            colorCode = colorCode,
            bgColorCode = bgColorCode,
            createdAt = now,
            updatedAt = now,
        )
    }

    private fun validateGradeColors(grades: List<GradeInput>) {
        for (grade in grades) {
            require(colorCodeRegex.matches(grade.colorCode)) {
                "Invalid colorCode '${grade.colorCode}' for grade '${grade.name}'. Must match ^#[0-9A-Fa-f]{6,8}$"
            }
            require(colorCodeRegex.matches(grade.bgColorCode)) {
                "Invalid bgColorCode '${grade.bgColorCode}' for grade '${grade.name}'. Must match ^#[0-9A-Fa-f]{6,8}$"
            }
        }
    }
}
