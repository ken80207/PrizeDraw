package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IBannerRepository
import com.prizedraw.domain.entities.Banner
import com.prizedraw.infrastructure.persistence.tables.BannersTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.or
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

public class BannerRepositoryImpl : IBannerRepository {
    override suspend fun findAllActive(): List<Banner> =
        newSuspendedTransaction {
            val now = OffsetDateTime.now(ZoneOffset.UTC)
            BannersTable
                .selectAll()
                .where {
                    (BannersTable.isActive eq true) and
                        ((BannersTable.scheduledStart.isNull()) or (BannersTable.scheduledStart lessEq now)) and
                        ((BannersTable.scheduledEnd.isNull()) or (BannersTable.scheduledEnd greater now))
                }.orderBy(BannersTable.sortOrder to SortOrder.ASC, BannersTable.createdAt to SortOrder.DESC)
                .map { it.toBanner() }
        }

    override suspend fun findAll(): List<Banner> =
        newSuspendedTransaction {
            BannersTable
                .selectAll()
                .orderBy(BannersTable.sortOrder to SortOrder.ASC, BannersTable.createdAt to SortOrder.DESC)
                .map { it.toBanner() }
        }

    override suspend fun findById(id: UUID): Banner? =
        newSuspendedTransaction {
            BannersTable
                .selectAll()
                .where { BannersTable.id eq id }
                .singleOrNull()
                ?.toBanner()
        }

    override suspend fun save(banner: Banner): Banner =
        newSuspendedTransaction {
            val existing =
                BannersTable
                    .selectAll()
                    .where { BannersTable.id eq banner.id }
                    .singleOrNull()

            if (existing == null) {
                BannersTable.insert {
                    it[id] = banner.id
                    it[imageUrl] = banner.imageUrl
                    it[linkType] = banner.linkType
                    it[linkUrl] = banner.linkUrl
                    it[sortOrder] = banner.sortOrder
                    it[isActive] = banner.isActive
                    it[scheduledStart] =
                        banner.scheduledStart
                            ?.toJavaInstant()
                            ?.let { instant -> OffsetDateTime.ofInstant(instant, ZoneOffset.UTC) }
                    it[scheduledEnd] =
                        banner.scheduledEnd
                            ?.toJavaInstant()
                            ?.let { instant -> OffsetDateTime.ofInstant(instant, ZoneOffset.UTC) }
                    it[createdBy] = banner.createdBy
                    it[updatedBy] = banner.updatedBy
                    it[createdAt] = OffsetDateTime.ofInstant(banner.createdAt.toJavaInstant(), ZoneOffset.UTC)
                    it[updatedAt] = OffsetDateTime.ofInstant(banner.updatedAt.toJavaInstant(), ZoneOffset.UTC)
                }
            } else {
                BannersTable.update({ BannersTable.id eq banner.id }) {
                    it[imageUrl] = banner.imageUrl
                    it[linkType] = banner.linkType
                    it[linkUrl] = banner.linkUrl
                    it[sortOrder] = banner.sortOrder
                    it[isActive] = banner.isActive
                    it[scheduledStart] =
                        banner.scheduledStart
                            ?.toJavaInstant()
                            ?.let { instant -> OffsetDateTime.ofInstant(instant, ZoneOffset.UTC) }
                    it[scheduledEnd] =
                        banner.scheduledEnd
                            ?.toJavaInstant()
                            ?.let { instant -> OffsetDateTime.ofInstant(instant, ZoneOffset.UTC) }
                    it[updatedBy] = banner.updatedBy
                    it[updatedAt] = OffsetDateTime.ofInstant(banner.updatedAt.toJavaInstant(), ZoneOffset.UTC)
                }
            }

            BannersTable
                .selectAll()
                .where { BannersTable.id eq banner.id }
                .single()
                .toBanner()
        }

    override suspend fun deactivate(
        id: UUID,
        updatedBy: UUID,
    ): Banner? =
        newSuspendedTransaction {
            val existing =
                BannersTable
                    .selectAll()
                    .where { BannersTable.id eq id }
                    .singleOrNull() ?: return@newSuspendedTransaction null

            val now = OffsetDateTime.now(ZoneOffset.UTC)
            BannersTable.update({ BannersTable.id eq id }) {
                it[isActive] = false
                it[BannersTable.updatedBy] = updatedBy
                it[updatedAt] = now
            }

            BannersTable
                .selectAll()
                .where { BannersTable.id eq id }
                .single()
                .toBanner()
        }

    private fun ResultRow.toBanner(): Banner =
        Banner(
            id = this[BannersTable.id],
            imageUrl = this[BannersTable.imageUrl],
            linkType = this[BannersTable.linkType],
            linkUrl = this[BannersTable.linkUrl],
            sortOrder = this[BannersTable.sortOrder],
            isActive = this[BannersTable.isActive],
            scheduledStart = this[BannersTable.scheduledStart]?.toInstant()?.toKotlinInstant(),
            scheduledEnd = this[BannersTable.scheduledEnd]?.toInstant()?.toKotlinInstant(),
            createdBy = this[BannersTable.createdBy],
            updatedBy = this[BannersTable.updatedBy],
            createdAt = this[BannersTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[BannersTable.updatedAt].toInstant().toKotlinInstant(),
        )
}
