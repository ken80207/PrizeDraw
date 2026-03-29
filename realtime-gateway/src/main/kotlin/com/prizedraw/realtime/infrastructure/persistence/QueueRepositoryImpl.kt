package com.prizedraw.realtime.infrastructure.persistence

import com.prizedraw.contracts.enums.QueueEntryStatus
import com.prizedraw.domain.entities.Queue
import com.prizedraw.domain.entities.QueueEntry
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.realtime.ports.IQueueEntryRepository
import com.prizedraw.realtime.ports.IQueueRepository
import com.prizedraw.schema.tables.QueueEntriesTable
import com.prizedraw.schema.tables.QueuesTable
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.notInList
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/** Exposed-backed implementation of [IQueueRepository] for the realtime-gateway. */
public class QueueRepositoryImpl : IQueueRepository {
    override suspend fun findByTicketBoxId(ticketBoxId: UUID): Queue? =
        newSuspendedTransaction {
            QueuesTable
                .selectAll()
                .where { QueuesTable.ticketBoxId eq ticketBoxId }
                .singleOrNull()
                ?.toQueue()
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

/** Exposed-backed implementation of [IQueueEntryRepository] for the realtime-gateway. */
public class QueueEntryRepositoryImpl : IQueueEntryRepository {
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
