package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.ILeaderboardRepository
import com.prizedraw.application.ports.output.LeaderboardEntry
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.infrastructure.persistence.tables.DrawTicketsTable
import com.prizedraw.infrastructure.persistence.tables.PlayersTable
import kotlinx.datetime.Instant
import kotlinx.datetime.toJavaInstant
import org.jetbrains.exposed.sql.JoinType
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.count
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * SQL-based leaderboard implementation.
 *
 * Queries are computed on-demand from [DrawTicketsTable]. For production workloads,
 * these queries should be backed by a materialized view or Redis sorted set updated
 * via the domain event / outbox pattern.
 */
public class LeaderboardRepositoryImpl : ILeaderboardRepository {
    override suspend fun findGlobalTopPlayers(
        from: Instant,
        until: Instant,
        limit: Int,
    ): List<LeaderboardEntry> =
        newSuspendedTransaction {
            val fromOdt = OffsetDateTime.ofInstant(from.toJavaInstant(), ZoneOffset.UTC)
            val untilOdt = OffsetDateTime.ofInstant(until.toJavaInstant(), ZoneOffset.UTC)

            DrawTicketsTable
                .join(PlayersTable, JoinType.INNER, DrawTicketsTable.drawnByPlayerId, PlayersTable.id)
                .select(
                    DrawTicketsTable.drawnByPlayerId,
                    PlayersTable.nickname,
                    DrawTicketsTable.id.count(),
                ).where {
                    (DrawTicketsTable.drawnByPlayerId.isNotNull()) and
                        (DrawTicketsTable.drawnAt greaterEq fromOdt) and
                        (DrawTicketsTable.drawnAt less untilOdt)
                }.groupBy(DrawTicketsTable.drawnByPlayerId, PlayersTable.nickname)
                .orderBy(DrawTicketsTable.id.count(), org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit)
                .mapIndexed { index, row ->
                    LeaderboardEntry(
                        rank = index + 1,
                        playerId = PlayerId(row[DrawTicketsTable.drawnByPlayerId]!!),
                        nickname = row[PlayersTable.nickname],
                        score = row[DrawTicketsTable.id.count()],
                    )
                }
        }

    override suspend fun findCampaignTopPlayers(
        campaignId: CampaignId,
        from: Instant,
        until: Instant,
        limit: Int,
    ): List<LeaderboardEntry> =
        newSuspendedTransaction {
            val fromOdt = OffsetDateTime.ofInstant(from.toJavaInstant(), ZoneOffset.UTC)
            val untilOdt = OffsetDateTime.ofInstant(until.toJavaInstant(), ZoneOffset.UTC)

            // Join through ticket_boxes to scope by campaign
            val ticketBoxesTable = com.prizedraw.infrastructure.persistence.tables.TicketBoxesTable

            DrawTicketsTable
                .join(ticketBoxesTable, JoinType.INNER, DrawTicketsTable.ticketBoxId, ticketBoxesTable.id)
                .join(PlayersTable, JoinType.INNER, DrawTicketsTable.drawnByPlayerId, PlayersTable.id)
                .select(
                    DrawTicketsTable.drawnByPlayerId,
                    PlayersTable.nickname,
                    DrawTicketsTable.id.count(),
                ).where {
                    (ticketBoxesTable.kujiCampaignId eq campaignId.value) and
                        (DrawTicketsTable.drawnByPlayerId.isNotNull()) and
                        (DrawTicketsTable.drawnAt greaterEq fromOdt) and
                        (DrawTicketsTable.drawnAt less untilOdt)
                }.groupBy(DrawTicketsTable.drawnByPlayerId, PlayersTable.nickname)
                .orderBy(DrawTicketsTable.id.count(), org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit)
                .mapIndexed { index, row ->
                    LeaderboardEntry(
                        rank = index + 1,
                        playerId = PlayerId(row[DrawTicketsTable.drawnByPlayerId]!!),
                        nickname = row[PlayersTable.nickname],
                        score = row[DrawTicketsTable.id.count()],
                    )
                }
        }

    override suspend fun findPlayerRank(
        playerId: PlayerId,
        from: Instant,
        until: Instant,
    ): Int? =
        newSuspendedTransaction {
            val fromOdt = OffsetDateTime.ofInstant(from.toJavaInstant(), ZoneOffset.UTC)
            val untilOdt = OffsetDateTime.ofInstant(until.toJavaInstant(), ZoneOffset.UTC)

            val all =
                DrawTicketsTable
                    .join(PlayersTable, JoinType.INNER, DrawTicketsTable.drawnByPlayerId, PlayersTable.id)
                    .select(
                        DrawTicketsTable.drawnByPlayerId,
                        DrawTicketsTable.id.count(),
                    ).where {
                        (DrawTicketsTable.drawnByPlayerId.isNotNull()) and
                            (DrawTicketsTable.drawnAt greaterEq fromOdt) and
                            (DrawTicketsTable.drawnAt less untilOdt)
                    }.groupBy(DrawTicketsTable.drawnByPlayerId)
                    .orderBy(DrawTicketsTable.id.count(), org.jetbrains.exposed.sql.SortOrder.DESC)
                    .toList()

            val idx = all.indexOfFirst { it[DrawTicketsTable.drawnByPlayerId] == playerId.value }
            if (idx == -1) {
                null
            } else {
                idx + 1
            }
        }
}
