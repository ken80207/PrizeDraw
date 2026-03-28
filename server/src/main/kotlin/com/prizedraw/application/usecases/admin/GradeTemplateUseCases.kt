package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.output.IGradeTemplateRepository
import com.prizedraw.domain.entities.GradeTemplate
import com.prizedraw.domain.entities.GradeTemplateItem
import kotlinx.datetime.Clock
import java.util.UUID

private val COLOR_CODE_REGEX = Regex("^#[0-9A-Fa-f]{6,8}$")

/**
 * Application-layer use cases for managing [GradeTemplate] presets.
 *
 * Templates are copied to campaigns on application — editing or deleting a template
 * does not affect campaigns that previously applied it.
 *
 * @property gradeTemplateRepository Output port for template persistence.
 */
public class GradeTemplateUseCases(
    private val gradeTemplateRepository: IGradeTemplateRepository,
) {
    /**
     * A single grade item supplied by the caller when creating or updating a template.
     */
    public data class ItemInput(
        val name: String,
        val displayOrder: Int,
        val colorCode: String,
        val bgColorCode: String,
    )

    /** Returns all grade templates ordered by name. */
    public suspend fun listTemplates(): List<GradeTemplate> = gradeTemplateRepository.findAll()

    /**
     * Returns a single template with its items, or null if not found.
     *
     * @param id The template's UUID.
     */
    public suspend fun getTemplate(id: UUID): GradeTemplate? = gradeTemplateRepository.findById(id)

    /**
     * Creates a new grade template.
     *
     * @param staffId UUID of the staff member creating the template.
     * @param name Template display name (must not be blank).
     * @param items Ordered list of grade tiers (must not be empty; all color codes must match `^#[0-9A-Fa-f]{6,8}$`).
     * @return The saved template.
     * @throws IllegalArgumentException if validation fails.
     */
    public suspend fun createTemplate(
        staffId: UUID,
        name: String,
        items: List<ItemInput>,
    ): GradeTemplate {
        require(name.isNotBlank()) { "Template name must not be blank" }
        require(items.isNotEmpty()) { "Template must have at least one item" }
        validateItemColors(items)

        val now = Clock.System.now()
        val templateId = UUID.randomUUID()

        val template =
            GradeTemplate(
                id = templateId,
                name = name.trim(),
                createdByStaffId = staffId,
                items =
                    items.map { input ->
                        GradeTemplateItem(
                            id = UUID.randomUUID(),
                            templateId = templateId,
                            name = input.name.trim(),
                            displayOrder = input.displayOrder,
                            colorCode = input.colorCode,
                            bgColorCode = input.bgColorCode,
                        )
                    },
                createdAt = now,
                updatedAt = now,
            )

        return gradeTemplateRepository.save(template)
    }

    /**
     * Replaces the name and items of an existing template.
     *
     * @param id UUID of the template to update.
     * @param name New template display name (must not be blank).
     * @param items New list of grade tiers (must not be empty; all color codes validated).
     * @return The updated template, or null if the template was not found.
     * @throws IllegalArgumentException if validation fails.
     */
    public suspend fun updateTemplate(
        id: UUID,
        name: String,
        items: List<ItemInput>,
    ): GradeTemplate? {
        require(name.isNotBlank()) { "Template name must not be blank" }
        require(items.isNotEmpty()) { "Template must have at least one item" }
        validateItemColors(items)

        val existing = gradeTemplateRepository.findById(id) ?: return null
        val now = Clock.System.now()

        val updated =
            existing.copy(
                name = name.trim(),
                items =
                    items.map { input ->
                        GradeTemplateItem(
                            id = UUID.randomUUID(),
                            templateId = id,
                            name = input.name.trim(),
                            displayOrder = input.displayOrder,
                            colorCode = input.colorCode,
                            bgColorCode = input.bgColorCode,
                        )
                    },
                updatedAt = now,
            )

        return gradeTemplateRepository.update(updated)
    }

    /**
     * Deletes a grade template and all its items.
     *
     * Safe to call at any time — campaigns copy template data at apply-time and
     * are not affected by template deletion.
     *
     * @param id UUID of the template to delete.
     */
    public suspend fun deleteTemplate(id: UUID): Unit = gradeTemplateRepository.delete(id)

    // --- Private helpers ---

    private fun validateItemColors(items: List<ItemInput>) {
        for (item in items) {
            require(COLOR_CODE_REGEX.matches(item.colorCode)) {
                "Invalid colorCode '${item.colorCode}' for item '${item.name}'. Must match ^#[0-9A-Fa-f]{6,8}$"
            }
            require(COLOR_CODE_REGEX.matches(item.bgColorCode)) {
                "Invalid bgColorCode '${item.bgColorCode}' for item '${item.name}'. Must match ^#[0-9A-Fa-f]{6,8}$"
            }
        }
    }
}
