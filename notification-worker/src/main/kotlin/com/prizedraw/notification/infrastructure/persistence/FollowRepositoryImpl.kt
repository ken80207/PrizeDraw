package com.prizedraw.notification.infrastructure.persistence

import com.prizedraw.notification.ports.IFollowRepository
import com.prizedraw.schema.tables.FollowsTable
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greater
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.select
import java.util.UUID

/**
 * Exposed-backed implementation of [IFollowRepository].
 *
 * Only exposes [findFollowerIdsBatch] — the subset required for outbox fan-out —
 * to avoid pulling in unnecessary query methods from the full server implementation.
 */
public class FollowRepositoryImpl : IFollowRepository {
    override suspend fun findFollowerIdsBatch(
        followingId: UUID,
        afterFollowId: UUID?,
        limit: Int,
    ): List<Pair<UUID, UUID>> =
        inTransaction {
            FollowsTable
                .select(FollowsTable.id, FollowsTable.followerId)
                .where {
                    val base = FollowsTable.followingId eq followingId
                    if (afterFollowId != null) {
                        base and (FollowsTable.id greater afterFollowId)
                    } else {
                        base
                    }
                }.orderBy(FollowsTable.id, SortOrder.ASC)
                .limit(limit)
                .map { row -> row[FollowsTable.id] to row[FollowsTable.followerId] }
        }
}
