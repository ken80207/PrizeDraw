package com.prizedraw.realtime.infrastructure.persistence

import com.prizedraw.domain.entities.DrawSyncSession
import com.prizedraw.realtime.ports.IDrawSyncRepository
import com.prizedraw.schema.tables.DrawSyncSessionsTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/**
 * Exposed implementation of [IDrawSyncRepository] for the realtime-gateway.
 */
public class DrawSyncRepositoryImpl : IDrawSyncRepository {
    override suspend fun save(session: DrawSyncSession): DrawSyncSession =
        newSuspendedTransaction {
            DrawSyncSessionsTable.insert {
                it[id] = session.id
                it[ticketId] = session.ticketId
                it[campaignId] = session.campaignId
                it[playerId] = session.playerId
                it[animationMode] = session.animationMode
                it[resultGrade] = session.resultGrade
                it[resultPrizeName] = session.resultPrizeName
                it[resultPhotoUrl] = session.resultPhotoUrl
                it[resultPrizeInstanceId] = session.resultPrizeInstanceId
                it[progress] = session.progress
                it[isRevealed] = session.isRevealed
                it[isCancelled] = session.isCancelled
                it[startedAt] = OffsetDateTime.ofInstant(session.startedAt.toJavaInstant(), ZoneOffset.UTC)
                it[revealedAt] =
                    session.revealedAt?.let { i ->
                        OffsetDateTime.ofInstant(i.toJavaInstant(), ZoneOffset.UTC)
                    }
                it[cancelledAt] =
                    session.cancelledAt?.let { i ->
                        OffsetDateTime.ofInstant(i.toJavaInstant(), ZoneOffset.UTC)
                    }
            }
            session
        }

    override suspend fun findById(id: UUID): DrawSyncSession? =
        newSuspendedTransaction {
            DrawSyncSessionsTable
                .selectAll()
                .where { DrawSyncSessionsTable.id eq id }
                .singleOrNull()
                ?.toDrawSyncSession()
        }

    override suspend fun findActiveByPlayer(playerId: UUID): DrawSyncSession? =
        newSuspendedTransaction {
            DrawSyncSessionsTable
                .selectAll()
                .where {
                    (DrawSyncSessionsTable.playerId eq playerId) and
                        (DrawSyncSessionsTable.isRevealed eq false) and
                        (DrawSyncSessionsTable.isCancelled eq false)
                }.singleOrNull()
                ?.toDrawSyncSession()
        }

    override suspend fun updateProgress(
        id: UUID,
        progress: Float,
    ) {
        newSuspendedTransaction {
            DrawSyncSessionsTable.update({ DrawSyncSessionsTable.id eq id }) {
                it[DrawSyncSessionsTable.progress] = progress
            }
        }
    }

    override suspend fun markRevealed(id: UUID) {
        newSuspendedTransaction {
            DrawSyncSessionsTable.update({ DrawSyncSessionsTable.id eq id }) {
                it[isRevealed] = true
                it[revealedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }
    }

    override suspend fun markCancelled(id: UUID) {
        newSuspendedTransaction {
            DrawSyncSessionsTable.update({ DrawSyncSessionsTable.id eq id }) {
                it[isCancelled] = true
                it[cancelledAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }
    }

    private fun ResultRow.toDrawSyncSession(): DrawSyncSession =
        DrawSyncSession(
            id = this[DrawSyncSessionsTable.id],
            ticketId = this[DrawSyncSessionsTable.ticketId],
            campaignId = this[DrawSyncSessionsTable.campaignId],
            playerId = this[DrawSyncSessionsTable.playerId],
            animationMode = this[DrawSyncSessionsTable.animationMode],
            resultGrade = this[DrawSyncSessionsTable.resultGrade],
            resultPrizeName = this[DrawSyncSessionsTable.resultPrizeName],
            resultPhotoUrl = this[DrawSyncSessionsTable.resultPhotoUrl],
            resultPrizeInstanceId = this[DrawSyncSessionsTable.resultPrizeInstanceId],
            progress = this[DrawSyncSessionsTable.progress],
            isRevealed = this[DrawSyncSessionsTable.isRevealed],
            isCancelled = this[DrawSyncSessionsTable.isCancelled],
            startedAt = this[DrawSyncSessionsTable.startedAt].toInstant().toKotlinInstant(),
            revealedAt = this[DrawSyncSessionsTable.revealedAt]?.toInstant()?.toKotlinInstant(),
            cancelledAt = this[DrawSyncSessionsTable.cancelledAt]?.toInstant()?.toKotlinInstant(),
        )
}
