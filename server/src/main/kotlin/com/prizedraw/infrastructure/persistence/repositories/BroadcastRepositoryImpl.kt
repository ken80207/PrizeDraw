package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IBroadcastRepository
import com.prizedraw.domain.entities.BroadcastSession
import com.prizedraw.schema.tables.BroadcastSessionsTable
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
 * Exposed implementation of [IBroadcastRepository].
 */
public class BroadcastRepositoryImpl : IBroadcastRepository {
    override suspend fun save(session: BroadcastSession): BroadcastSession =
        newSuspendedTransaction {
            BroadcastSessionsTable.insert {
                it[id] = session.id
                it[campaignId] = session.campaignId
                it[playerId] = session.playerId
                it[isActive] = session.isActive
                it[viewerCount] = session.viewerCount
                it[startedAt] = OffsetDateTime.ofInstant(session.startedAt.toJavaInstant(), ZoneOffset.UTC)
                it[endedAt] =
                    session.endedAt?.let { i ->
                        OffsetDateTime.ofInstant(i.toJavaInstant(), ZoneOffset.UTC)
                    }
            }
            session
        }

    override suspend fun findActiveByPlayer(playerId: UUID): BroadcastSession? =
        newSuspendedTransaction {
            BroadcastSessionsTable
                .selectAll()
                .where {
                    (BroadcastSessionsTable.playerId eq playerId) and
                        (BroadcastSessionsTable.isActive eq true)
                }.singleOrNull()
                ?.toBroadcastSession()
        }

    override suspend fun findActiveByCampaign(campaignId: UUID): List<BroadcastSession> =
        newSuspendedTransaction {
            BroadcastSessionsTable
                .selectAll()
                .where {
                    (BroadcastSessionsTable.campaignId eq campaignId) and
                        (BroadcastSessionsTable.isActive eq true)
                }.map { it.toBroadcastSession() }
        }

    override suspend fun endSession(sessionId: UUID) {
        newSuspendedTransaction {
            BroadcastSessionsTable.update({ BroadcastSessionsTable.id eq sessionId }) {
                it[isActive] = false
                it[endedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }
    }

    override suspend fun updateViewerCount(
        sessionId: UUID,
        count: Int,
    ) {
        newSuspendedTransaction {
            BroadcastSessionsTable.update({ BroadcastSessionsTable.id eq sessionId }) {
                it[viewerCount] = count
            }
        }
    }

    private fun ResultRow.toBroadcastSession(): BroadcastSession =
        BroadcastSession(
            id = this[BroadcastSessionsTable.id],
            campaignId = this[BroadcastSessionsTable.campaignId],
            playerId = this[BroadcastSessionsTable.playerId],
            isActive = this[BroadcastSessionsTable.isActive],
            viewerCount = this[BroadcastSessionsTable.viewerCount],
            startedAt = this[BroadcastSessionsTable.startedAt].toInstant().toKotlinInstant(),
            endedAt = this[BroadcastSessionsTable.endedAt]?.toInstant()?.toKotlinInstant(),
        )
}
