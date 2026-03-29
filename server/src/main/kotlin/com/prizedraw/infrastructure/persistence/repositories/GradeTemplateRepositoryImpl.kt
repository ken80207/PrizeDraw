package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IGradeTemplateRepository
import com.prizedraw.domain.entities.GradeTemplate
import com.prizedraw.domain.entities.GradeTemplateItem
import com.prizedraw.schema.tables.GradeTemplateItemsTable
import com.prizedraw.schema.tables.GradeTemplatesTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

public class GradeTemplateRepositoryImpl : IGradeTemplateRepository {
    override suspend fun findAll(): List<GradeTemplate> =
        newSuspendedTransaction {
            val templates = GradeTemplatesTable.selectAll().orderBy(GradeTemplatesTable.name).map { it }
            val templateIds = templates.map { it[GradeTemplatesTable.id] }
            val allItems =
                if (templateIds.isEmpty()) {
                    emptyList()
                } else {
                    GradeTemplateItemsTable
                        .selectAll()
                        .where { GradeTemplateItemsTable.templateId inList templateIds }
                        .map { it.toGradeTemplateItem() }
                }
            val itemsByTemplateId = allItems.groupBy { it.templateId }
            templates.map { row ->
                val id = row[GradeTemplatesTable.id]
                row.toGradeTemplate(itemsByTemplateId[id].orEmpty())
            }
        }

    override suspend fun findById(id: UUID): GradeTemplate? =
        newSuspendedTransaction {
            val template =
                GradeTemplatesTable
                    .selectAll()
                    .where { GradeTemplatesTable.id eq id }
                    .singleOrNull() ?: return@newSuspendedTransaction null
            val items =
                GradeTemplateItemsTable
                    .selectAll()
                    .where { GradeTemplateItemsTable.templateId eq id }
                    .map { it.toGradeTemplateItem() }
            template.toGradeTemplate(items)
        }

    override suspend fun save(template: GradeTemplate): GradeTemplate =
        newSuspendedTransaction {
            GradeTemplatesTable.insert {
                it[id] = template.id
                it[name] = template.name
                it[createdBy] = template.createdByStaffId
                it[createdAt] = template.createdAt.toOffsetDateTime()
                it[updatedAt] = template.updatedAt.toOffsetDateTime()
            }
            template.items.forEach { item ->
                GradeTemplateItemsTable.insert {
                    it[id] = item.id
                    it[templateId] = item.templateId
                    it[name] = item.name
                    it[displayOrder] = item.displayOrder
                    it[colorCode] = item.colorCode
                    it[bgColorCode] = item.bgColorCode
                    it[createdAt] = template.createdAt.toOffsetDateTime()
                    it[updatedAt] = template.updatedAt.toOffsetDateTime()
                }
            }
            findById(template.id) ?: template
        }

    override suspend fun update(template: GradeTemplate): GradeTemplate =
        newSuspendedTransaction {
            GradeTemplatesTable.update({ GradeTemplatesTable.id eq template.id }) {
                it[name] = template.name
                it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
            GradeTemplateItemsTable.deleteWhere { templateId eq template.id }
            val now = OffsetDateTime.now(ZoneOffset.UTC)
            template.items.forEach { item ->
                GradeTemplateItemsTable.insert {
                    it[id] = item.id
                    it[templateId] = item.templateId
                    it[name] = item.name
                    it[displayOrder] = item.displayOrder
                    it[colorCode] = item.colorCode
                    it[bgColorCode] = item.bgColorCode
                    it[createdAt] = now
                    it[updatedAt] = now
                }
            }
            findById(template.id) ?: template
        }

    override suspend fun delete(id: UUID): Unit =
        newSuspendedTransaction {
            GradeTemplateItemsTable.deleteWhere { templateId eq id }
            GradeTemplatesTable.deleteWhere { GradeTemplatesTable.id eq id }
        }

    private fun ResultRow.toGradeTemplateItem(): GradeTemplateItem =
        GradeTemplateItem(
            id = this[GradeTemplateItemsTable.id],
            templateId = this[GradeTemplateItemsTable.templateId],
            name = this[GradeTemplateItemsTable.name],
            displayOrder = this[GradeTemplateItemsTable.displayOrder],
            colorCode = this[GradeTemplateItemsTable.colorCode],
            bgColorCode = this[GradeTemplateItemsTable.bgColorCode],
        )

    private fun ResultRow.toGradeTemplate(items: List<GradeTemplateItem>): GradeTemplate =
        GradeTemplate(
            id = this[GradeTemplatesTable.id],
            name = this[GradeTemplatesTable.name],
            createdByStaffId = this[GradeTemplatesTable.createdBy],
            items = items.sortedBy { it.displayOrder },
            createdAt = this[GradeTemplatesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[GradeTemplatesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

private fun kotlinx.datetime.Instant.toOffsetDateTime(): java.time.OffsetDateTime =
    java.time.OffsetDateTime.ofInstant(toJavaInstant(), java.time.ZoneOffset.UTC)
