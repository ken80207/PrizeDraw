package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.domain.entities.Follow
import com.prizedraw.infrastructure.persistence.inTransaction
import com.prizedraw.schema.tables.FollowsTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greater
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/**
 * Exposed-backed implementation of [IFollowRepository].
 *
 * All mutations and queries use [inTransaction] for coroutine-safe execution.
 * Timestamps are stored as [OffsetDateTime] (UTC) to match the `TIMESTAMPTZ`
 * column type and converted to/from [kotlinx.datetime.Instant] at the boundary.
 */
public class FollowRepositoryImpl : IFollowRepository {
    override suspend fun save(follow: Follow): Follow =
        inTransaction {
            FollowsTable.insert {
                it[id] = follow.id
                it[followerId] = follow.followerId
                it[followingId] = follow.followingId
                it[createdAt] = OffsetDateTime.ofInstant(follow.createdAt.toJavaInstant(), ZoneOffset.UTC)
            }
            FollowsTable
                .selectAll()
                .where { FollowsTable.id eq follow.id }
                .single()
                .toFollow()
        }

    override suspend fun delete(
        followerId: UUID,
        followingId: UUID,
    ): Boolean =
        inTransaction {
            val deletedRows =
                FollowsTable.deleteWhere {
                    (FollowsTable.followerId eq followerId) and (FollowsTable.followingId eq followingId)
                }
            deletedRows > 0
        }

    override suspend fun exists(
        followerId: UUID,
        followingId: UUID,
    ): Boolean =
        inTransaction {
            FollowsTable
                .selectAll()
                .where { (FollowsTable.followerId eq followerId) and (FollowsTable.followingId eq followingId) }
                .count() > 0
        }

    override suspend fun existsBatch(
        followerId: UUID,
        followingIds: List<UUID>,
    ): Set<UUID> {
        if (followingIds.isEmpty()) {
            return emptySet()
        }
        return inTransaction {
            FollowsTable
                .select(FollowsTable.followingId)
                .where {
                    (FollowsTable.followerId eq followerId) and (FollowsTable.followingId inList followingIds)
                }.map { it[FollowsTable.followingId] }
                .toSet()
        }
    }

    override suspend fun findFollowing(
        followerId: UUID,
        limit: Int,
        offset: Int,
    ): List<Follow> =
        inTransaction {
            FollowsTable
                .selectAll()
                .where { FollowsTable.followerId eq followerId }
                .orderBy(FollowsTable.createdAt, SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toFollow() }
        }

    override suspend fun findFollowers(
        followingId: UUID,
        limit: Int,
        offset: Int,
    ): List<Follow> =
        inTransaction {
            FollowsTable
                .selectAll()
                .where { FollowsTable.followingId eq followingId }
                .orderBy(FollowsTable.createdAt, SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toFollow() }
        }

    override suspend fun countFollowing(playerId: UUID): Int =
        inTransaction {
            FollowsTable
                .selectAll()
                .where { FollowsTable.followerId eq playerId }
                .count()
                .toInt()
        }

    override suspend fun countFollowers(playerId: UUID): Int =
        inTransaction {
            FollowsTable
                .selectAll()
                .where { FollowsTable.followingId eq playerId }
                .count()
                .toInt()
        }

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

    private fun ResultRow.toFollow(): Follow =
        Follow(
            id = this[FollowsTable.id],
            followerId = this[FollowsTable.followerId],
            followingId = this[FollowsTable.followingId],
            createdAt = this[FollowsTable.createdAt].toInstant().toKotlinInstant(),
        )
}
