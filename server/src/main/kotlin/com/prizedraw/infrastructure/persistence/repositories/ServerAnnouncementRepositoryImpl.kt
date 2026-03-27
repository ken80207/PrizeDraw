package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IServerAnnouncementRepository
import com.prizedraw.domain.entities.AnnouncementEntityType
import com.prizedraw.domain.entities.ServerAnnouncement
import com.prizedraw.infrastructure.persistence.tables.ServerAnnouncementTable
import kotlinx.datetime.Clock
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/**
 * Exposed-backed implementation of [IServerAnnouncementRepository].
 *
 * All mutations use [newSuspendedTransaction] to participate in structured
 * concurrency without blocking dispatcher threads.
 */
public class ServerAnnouncementRepositoryImpl : IServerAnnouncementRepository {
    override suspend fun findAllActive(): List<ServerAnnouncement> =
        newSuspendedTransaction {
            val now = OffsetDateTime.now(ZoneOffset.UTC)
            ServerAnnouncementTable
                .selectAll()
                .where { ServerAnnouncementTable.isActive eq true }
                .orderBy(ServerAnnouncementTable.createdAt to org.jetbrains.exposed.sql.SortOrder.DESC)
                .map { it.toAnnouncement() }
                .filter { announcement ->
                    val start = announcement.scheduledStart
                    val end = announcement.scheduledEnd
                    val nowKotlin = Clock.System.now()
                    (start == null || start <= nowKotlin) && (end == null || end > nowKotlin)
                }
        }

    override suspend fun findAll(): List<ServerAnnouncement> =
        newSuspendedTransaction {
            ServerAnnouncementTable
                .selectAll()
                .orderBy(ServerAnnouncementTable.createdAt to org.jetbrains.exposed.sql.SortOrder.DESC)
                .map { it.toAnnouncement() }
        }

    override suspend fun findById(id: UUID): ServerAnnouncement? =
        newSuspendedTransaction {
            ServerAnnouncementTable
                .selectAll()
                .where { ServerAnnouncementTable.id eq id }
                .singleOrNull()
                ?.toAnnouncement()
        }

    override suspend fun save(announcement: ServerAnnouncement): ServerAnnouncement =
        newSuspendedTransaction {
            val existing =
                ServerAnnouncementTable
                    .selectAll()
                    .where { ServerAnnouncementTable.id eq announcement.id }
                    .singleOrNull()

            if (existing == null) {
                ServerAnnouncementTable.insert {
                    it[id] = announcement.id
                    it[type] = announcement.type.name
                    it[title] = announcement.title
                    it[message] = announcement.message
                    it[isActive] = announcement.isActive
                    it[isBlocking] = announcement.isBlocking
                    it[targetPlatforms] = announcement.targetPlatforms
                    it[minAppVersion] = announcement.minAppVersion
                    it[scheduledStart] =
                        announcement.scheduledStart
                            ?.toJavaInstant()
                            ?.let { instant -> OffsetDateTime.ofInstant(instant, ZoneOffset.UTC) }
                    it[scheduledEnd] =
                        announcement.scheduledEnd
                            ?.toJavaInstant()
                            ?.let { instant -> OffsetDateTime.ofInstant(instant, ZoneOffset.UTC) }
                    it[createdByStaffId] = announcement.createdByStaffId
                    it[createdAt] = OffsetDateTime.ofInstant(announcement.createdAt.toJavaInstant(), ZoneOffset.UTC)
                    it[updatedAt] = OffsetDateTime.ofInstant(announcement.updatedAt.toJavaInstant(), ZoneOffset.UTC)
                }
            } else {
                ServerAnnouncementTable.update({ ServerAnnouncementTable.id eq announcement.id }) {
                    it[type] = announcement.type.name
                    it[title] = announcement.title
                    it[message] = announcement.message
                    it[isActive] = announcement.isActive
                    it[isBlocking] = announcement.isBlocking
                    it[targetPlatforms] = announcement.targetPlatforms
                    it[minAppVersion] = announcement.minAppVersion
                    it[scheduledStart] =
                        announcement.scheduledStart
                            ?.toJavaInstant()
                            ?.let { instant -> OffsetDateTime.ofInstant(instant, ZoneOffset.UTC) }
                    it[scheduledEnd] =
                        announcement.scheduledEnd
                            ?.toJavaInstant()
                            ?.let { instant -> OffsetDateTime.ofInstant(instant, ZoneOffset.UTC) }
                    it[updatedAt] = OffsetDateTime.ofInstant(announcement.updatedAt.toJavaInstant(), ZoneOffset.UTC)
                }
            }

            ServerAnnouncementTable
                .selectAll()
                .where { ServerAnnouncementTable.id eq announcement.id }
                .single()
                .toAnnouncement()
        }

    override suspend fun deactivate(id: UUID): ServerAnnouncement? =
        newSuspendedTransaction {
            val existing =
                ServerAnnouncementTable
                    .selectAll()
                    .where { ServerAnnouncementTable.id eq id }
                    .singleOrNull() ?: return@newSuspendedTransaction null

            val now = OffsetDateTime.now(ZoneOffset.UTC)
            ServerAnnouncementTable.update({ ServerAnnouncementTable.id eq id }) {
                it[isActive] = false
                it[updatedAt] = now
            }

            ServerAnnouncementTable
                .selectAll()
                .where { ServerAnnouncementTable.id eq id }
                .single()
                .toAnnouncement()
        }

    private fun ResultRow.toAnnouncement(): ServerAnnouncement =
        ServerAnnouncement(
            id = this[ServerAnnouncementTable.id],
            type = AnnouncementEntityType.valueOf(this[ServerAnnouncementTable.type]),
            title = this[ServerAnnouncementTable.title],
            message = this[ServerAnnouncementTable.message],
            isActive = this[ServerAnnouncementTable.isActive],
            isBlocking = this[ServerAnnouncementTable.isBlocking],
            targetPlatforms = this[ServerAnnouncementTable.targetPlatforms].toList(),
            minAppVersion = this[ServerAnnouncementTable.minAppVersion],
            scheduledStart = this[ServerAnnouncementTable.scheduledStart]?.toInstant()?.toKotlinInstant(),
            scheduledEnd = this[ServerAnnouncementTable.scheduledEnd]?.toInstant()?.toKotlinInstant(),
            createdByStaffId = this[ServerAnnouncementTable.createdByStaffId],
            createdAt = this[ServerAnnouncementTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[ServerAnnouncementTable.updatedAt].toInstant().toKotlinInstant(),
        )
}
