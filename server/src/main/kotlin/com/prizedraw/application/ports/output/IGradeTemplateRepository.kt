package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.GradeTemplate
import java.util.UUID

/**
 * Output port for grade template persistence.
 */
public interface IGradeTemplateRepository {
    /** Returns all grade templates ordered by name. */
    public suspend fun findAll(): List<GradeTemplate>

    /** Returns a single template with items, or null if not found. */
    public suspend fun findById(id: UUID): GradeTemplate?

    /** Inserts a new template with its items. Returns the saved template. */
    public suspend fun save(template: GradeTemplate): GradeTemplate

    /** Replaces all items for an existing template. Returns the updated template. */
    public suspend fun update(template: GradeTemplate): GradeTemplate

    /** Deletes a template and all its items. */
    public suspend fun delete(id: UUID)
}
