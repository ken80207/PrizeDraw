package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.ICampaignGradeRepository
import com.prizedraw.domain.entities.CampaignGrade
import com.prizedraw.domain.valueobjects.CampaignGradeId
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.schema.tables.CampaignGradesTable
import com.prizedraw.schema.tables.PrizeDefinitionsTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.or
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.time.OffsetDateTime
import java.time.ZoneOffset

public class CampaignGradeRepositoryImpl : ICampaignGradeRepository {
    override suspend fun findByCampaignId(campaignId: CampaignId): List<CampaignGrade> =
        newSuspendedTransaction {
            CampaignGradesTable
                .selectAll()
                .where {
                    (CampaignGradesTable.kujiCampaignId eq campaignId.value) or
                        (CampaignGradesTable.unlimitedCampaignId eq campaignId.value)
                }.orderBy(CampaignGradesTable.displayOrder)
                .map { it.toCampaignGrade() }
        }

    override suspend fun findById(id: CampaignGradeId): CampaignGrade? =
        newSuspendedTransaction {
            CampaignGradesTable
                .selectAll()
                .where { CampaignGradesTable.id eq id.value }
                .singleOrNull()
                ?.toCampaignGrade()
        }

    override suspend fun saveAll(grades: List<CampaignGrade>): List<CampaignGrade> =
        newSuspendedTransaction {
            grades.forEach { grade ->
                CampaignGradesTable.insert {
                    it[id] = grade.id.value
                    it[kujiCampaignId] = grade.kujiCampaignId?.value
                    it[unlimitedCampaignId] = grade.unlimitedCampaignId?.value
                    it[name] = grade.name
                    it[displayOrder] = grade.displayOrder
                    it[colorCode] = grade.colorCode
                    it[bgColorCode] = grade.bgColorCode
                    it[createdAt] = grade.createdAt.toOffsetDateTime()
                    it[updatedAt] = grade.updatedAt.toOffsetDateTime()
                }
            }
            val ids = grades.map { it.id.value }
            CampaignGradesTable
                .selectAll()
                .where { CampaignGradesTable.id inList ids }
                .orderBy(CampaignGradesTable.displayOrder)
                .map { it.toCampaignGrade() }
        }

    override suspend fun replaceAll(
        campaignId: CampaignId,
        grades: List<CampaignGrade>,
    ): List<CampaignGrade> =
        newSuspendedTransaction {
            CampaignGradesTable.deleteWhere {
                (kujiCampaignId eq campaignId.value) or
                    (unlimitedCampaignId eq campaignId.value)
            }
            grades.forEach { grade ->
                CampaignGradesTable.insert {
                    it[id] = grade.id.value
                    it[kujiCampaignId] = grade.kujiCampaignId?.value
                    it[unlimitedCampaignId] = grade.unlimitedCampaignId?.value
                    it[name] = grade.name
                    it[displayOrder] = grade.displayOrder
                    it[colorCode] = grade.colorCode
                    it[bgColorCode] = grade.bgColorCode
                    it[createdAt] = grade.createdAt.toOffsetDateTime()
                    it[updatedAt] = grade.updatedAt.toOffsetDateTime()
                }
            }
            val ids = grades.map { it.id.value }
            CampaignGradesTable
                .selectAll()
                .where { CampaignGradesTable.id inList ids }
                .orderBy(CampaignGradesTable.displayOrder)
                .map { it.toCampaignGrade() }
        }

    override suspend fun delete(id: CampaignGradeId): Boolean =
        newSuspendedTransaction {
            val refs = countPrizeReferences(id)
            if (refs > 0) {
                return@newSuspendedTransaction false
            }
            CampaignGradesTable.deleteWhere { CampaignGradesTable.id eq id.value }
            true
        }

    override suspend fun deleteAllByCampaignId(campaignId: CampaignId): Unit =
        newSuspendedTransaction {
            val grades =
                CampaignGradesTable
                    .selectAll()
                    .where {
                        (CampaignGradesTable.kujiCampaignId eq campaignId.value) or
                            (CampaignGradesTable.unlimitedCampaignId eq campaignId.value)
                    }.map { CampaignGradeId(it[CampaignGradesTable.id]) }
            grades.forEach { gradeId ->
                val refs = countPrizeReferences(gradeId)
                if (refs == 0L) {
                    CampaignGradesTable.deleteWhere { id eq gradeId.value }
                }
            }
        }

    override suspend fun countPrizeReferences(id: CampaignGradeId): Long =
        newSuspendedTransaction {
            PrizeDefinitionsTable
                .selectAll()
                .where { PrizeDefinitionsTable.campaignGradeId eq id.value }
                .count()
        }

    private fun ResultRow.toCampaignGrade(): CampaignGrade =
        CampaignGrade(
            id = CampaignGradeId(this[CampaignGradesTable.id]),
            kujiCampaignId = this[CampaignGradesTable.kujiCampaignId]?.let { CampaignId(it) },
            unlimitedCampaignId = this[CampaignGradesTable.unlimitedCampaignId]?.let { CampaignId(it) },
            name = this[CampaignGradesTable.name],
            displayOrder = this[CampaignGradesTable.displayOrder],
            colorCode = this[CampaignGradesTable.colorCode],
            bgColorCode = this[CampaignGradesTable.bgColorCode],
            createdAt = this[CampaignGradesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[CampaignGradesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

private fun kotlinx.datetime.Instant.toOffsetDateTime(): java.time.OffsetDateTime =
    java.time.OffsetDateTime.ofInstant(toJavaInstant(), java.time.ZoneOffset.UTC)
