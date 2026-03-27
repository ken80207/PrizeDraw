package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IQueueEntryRepository
import com.prizedraw.application.ports.output.IQueueRepository
import com.prizedraw.contracts.enums.QueueEntryStatus
import com.prizedraw.domain.entities.Queue
import com.prizedraw.domain.entities.QueueEntry
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.infrastructure.persistence.tables.QueueEntriesTable
import com.prizedraw.infrastructure.persistence.tables.QueuesTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.SqlExpressionBuilder.notInList
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** Exposed-backed implementation of [IQueueRepository]. */
public class QueueRepositoryImpl : IQueueRepository {
    override suspend fun findById(id: UUID): Queue? =
        newSuspendedTransaction {
            QueuesTable
                .selectAll()
                .where { QueuesTable.id eq id }
                .singleOrNull()
                ?.toQueue()
        }

    override suspend fun findByTicketBoxId(ticketBoxId: UUID): Queue? =
        newSuspendedTransaction {
            QueuesTable
                .selectAll()
                .where { QueuesTable.ticketBoxId eq ticketBoxId }
                .singleOrNull()
                ?.toQueue()
        }

    override suspend fun save(queue: Queue): Queue =
        newSuspendedTransaction {
            val existing =
                QueuesTable
                    .selectAll()
                    .where { QueuesTable.id eq queue.id }
                    .singleOrNull()
            if (existing == null) {
                QueuesTable.insert {
                    it[id] = queue.id
                    it[ticketBoxId] = queue.ticketBoxId
                    it[activePlayerId] = queue.activePlayerId?.value
                    it[sessionStartedAt] = queue.sessionStartedAt?.toOffsetDateTime()
                    it[sessionExpiresAt] = queue.sessionExpiresAt?.toOffsetDateTime()
                    it[createdAt] = queue.createdAt.toOffsetDateTime()
                    it[updatedAt] = queue.updatedAt.toOffsetDateTime()
                }
            } else {
                QueuesTable.update({ QueuesTable.id eq queue.id }) {
                    it[activePlayerId] = queue.activePlayerId?.value
                    it[sessionStartedAt] = queue.sessionStartedAt?.toOffsetDateTime()
                    it[sessionExpiresAt] = queue.sessionExpiresAt?.toOffsetDateTime()
                    it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
                }
            }
            QueuesTable
                .selectAll()
                .where { QueuesTable.id eq queue.id }
                .single()
                .toQueue()
        }

    private fun ResultRow.toQueue(): Queue =
        Queue(
            id = this[QueuesTable.id],
            ticketBoxId = this[QueuesTable.ticketBoxId],
            activePlayerId = this[QueuesTable.activePlayerId]?.let { PlayerId(it) },
            sessionStartedAt = this[QueuesTable.sessionStartedAt]?.toInstant()?.toKotlinInstant(),
            sessionExpiresAt = this[QueuesTable.sessionExpiresAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[QueuesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[QueuesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

private val terminalStatuses =
    listOf(
        QueueEntryStatus.COMPLETED,
        QueueEntryStatus.ABANDONED,
        QueueEntryStatus.EVICTED,
    )

/** Exposed-backed implementation of [IQueueEntryRepository]. */
public class QueueEntryRepositoryImpl : IQueueEntryRepository {
    override suspend fun findById(id: UUID): QueueEntry? =
        newSuspendedTransaction {
            QueueEntriesTable
                .selectAll()
                .where { QueueEntriesTable.id eq id }
                .singleOrNull()
                ?.toQueueEntry()
        }

    override suspend fun findActiveEntry(
        queueId: UUID,
        playerId: PlayerId,
    ): QueueEntry? =
        newSuspendedTransaction {
            QueueEntriesTable
                .selectAll()
                .where {
                    (QueueEntriesTable.queueId eq queueId) and
                        (QueueEntriesTable.playerId eq playerId.value) and
                        (QueueEntriesTable.status notInList terminalStatuses)
                }.singleOrNull()
                ?.toQueueEntry()
        }

    override suspend fun findActiveEntries(queueId: UUID): List<QueueEntry> =
        newSuspendedTransaction {
            QueueEntriesTable
                .selectAll()
                .where {
                    (QueueEntriesTable.queueId eq queueId) and
                        (QueueEntriesTable.status notInList terminalStatuses)
                }.orderBy(QueueEntriesTable.position)
                .map { it.toQueueEntry() }
        }

    override suspend fun findNextWaiting(queueId: UUID): QueueEntry? =
        newSuspendedTransaction {
            QueueEntriesTable
                .selectAll()
                .where {
                    (QueueEntriesTable.queueId eq queueId) and
                        (QueueEntriesTable.status eq QueueEntryStatus.WAITING)
                }.orderBy(QueueEntriesTable.position)
                .limit(1)
                .singleOrNull()
                ?.toQueueEntry()
        }

    override suspend fun countActiveEntriesBefore(
        queueId: UUID,
        position: Int,
    ): Int =
        newSuspendedTransaction {
            QueueEntriesTable
                .selectAll()
                .where {
                    (QueueEntriesTable.queueId eq queueId) and
                        (QueueEntriesTable.position less position) and
                        (QueueEntriesTable.status notInList terminalStatuses)
                }.count()
                .toInt()
        }

    override suspend fun save(entry: QueueEntry): QueueEntry =
        newSuspendedTransaction {
            val existing =
                QueueEntriesTable
                    .selectAll()
                    .where { QueueEntriesTable.id eq entry.id }
                    .singleOrNull()
            if (existing == null) {
                QueueEntriesTable.insert {
                    it[id] = entry.id
                    it[queueId] = entry.queueId
                    it[playerId] = entry.playerId.value
                    it[position] = entry.position
                    it[status] = entry.status
                    it[joinedAt] = entry.joinedAt.toOffsetDateTime()
                    it[activatedAt] = entry.activatedAt?.toOffsetDateTime()
                    it[completedAt] = entry.completedAt?.toOffsetDateTime()
                    it[createdAt] = entry.createdAt.toOffsetDateTime()
                    it[updatedAt] = entry.updatedAt.toOffsetDateTime()
                }
            } else {
                QueueEntriesTable.update({ QueueEntriesTable.id eq entry.id }) {
                    it[status] = entry.status
                    it[activatedAt] = entry.activatedAt?.toOffsetDateTime()
                    it[completedAt] = entry.completedAt?.toOffsetDateTime()
                    it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
                }
            }
            QueueEntriesTable
                .selectAll()
                .where { QueueEntriesTable.id eq entry.id }
                .single()
                .toQueueEntry()
        }

    private fun ResultRow.toQueueEntry(): QueueEntry =
        QueueEntry(
            id = this[QueueEntriesTable.id],
            queueId = this[QueueEntriesTable.queueId],
            playerId = PlayerId(this[QueueEntriesTable.playerId]),
            position = this[QueueEntriesTable.position],
            status = this[QueueEntriesTable.status],
            joinedAt = this[QueueEntriesTable.joinedAt].toInstant().toKotlinInstant(),
            activatedAt = this[QueueEntriesTable.activatedAt]?.toInstant()?.toKotlinInstant(),
            completedAt = this[QueueEntriesTable.completedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[QueueEntriesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[QueueEntriesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

private fun kotlinx.datetime.Instant.toOffsetDateTime(): OffsetDateTime =
    OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)
