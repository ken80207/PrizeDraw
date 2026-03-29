package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IRoomInstanceRepository
import com.prizedraw.domain.entities.RoomInstance
import com.prizedraw.schema.tables.CampaignViewerStatsTable
import com.prizedraw.schema.tables.RoomInstancesTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greater
import org.jetbrains.exposed.sql.SqlExpressionBuilder.less
import org.jetbrains.exposed.sql.SqlExpressionBuilder.minus
import org.jetbrains.exposed.sql.SqlExpressionBuilder.plus
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import org.jetbrains.exposed.sql.upsert
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/**
 * Exposed implementation of [IRoomInstanceRepository].
 *
 * Player count mutations use atomic SQL arithmetic expressions to avoid
 * lost-update races under concurrent WebSocket connection storms.
 */
public class RoomInstanceRepositoryImpl : IRoomInstanceRepository {
    override suspend fun findActiveByCampaign(campaignId: UUID): List<RoomInstance> =
        newSuspendedTransaction {
            RoomInstancesTable
                .selectAll()
                .where {
                    (RoomInstancesTable.campaignId eq campaignId) and
                        (RoomInstancesTable.isActive eq true)
                }.orderBy(RoomInstancesTable.instanceNumber)
                .map { it.toRoomInstance() }
        }

    override suspend fun findById(id: UUID): RoomInstance? =
        newSuspendedTransaction {
            RoomInstancesTable
                .selectAll()
                .where { RoomInstancesTable.id eq id }
                .singleOrNull()
                ?.toRoomInstance()
        }

    override suspend fun save(instance: RoomInstance): RoomInstance =
        newSuspendedTransaction {
            RoomInstancesTable.insert {
                it[id] = instance.id
                it[campaignId] = instance.campaignId
                it[instanceNumber] = instance.instanceNumber
                it[playerCount] = instance.playerCount
                it[maxPlayers] = instance.maxPlayers
                it[isActive] = instance.isActive
                it[createdAt] = OffsetDateTime.ofInstant(instance.createdAt.toJavaInstant(), ZoneOffset.UTC)
                it[updatedAt] = OffsetDateTime.ofInstant(instance.updatedAt.toJavaInstant(), ZoneOffset.UTC)
            }
            instance
        }

    override suspend fun incrementPlayerCount(instanceId: UUID): Unit =
        newSuspendedTransaction {
            RoomInstancesTable.update({ RoomInstancesTable.id eq instanceId }) {
                it[playerCount] = playerCount + 1
                it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }

    override suspend fun decrementPlayerCount(instanceId: UUID): Unit =
        newSuspendedTransaction {
            // Clamp at zero: only decrement rows where player_count > 0.
            RoomInstancesTable.update({
                (RoomInstancesTable.id eq instanceId) and
                    (RoomInstancesTable.playerCount greater 0)
            }) {
                it[playerCount] = playerCount - 1
                it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }

    override suspend fun deactivateEmptyRooms(
        emptyForMinutes: Int,
        keepMinimum: Int,
    ): Unit =
        newSuspendedTransaction {
            // Collect distinct campaign IDs that have empty active shards.
            val cutoff = OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(emptyForMinutes.toLong())

            val emptyCandidates =
                RoomInstancesTable
                    .selectAll()
                    .where {
                        (RoomInstancesTable.isActive eq true) and
                            (RoomInstancesTable.playerCount eq 0) and
                            (RoomInstancesTable.updatedAt less cutoff)
                    }.orderBy(RoomInstancesTable.campaignId)
                    .orderBy(RoomInstancesTable.instanceNumber)
                    .map { it.toRoomInstance() }

            // Group by campaign and skip the minimum set of shards per campaign.
            emptyCandidates
                .groupBy { it.campaignId }
                .forEach { (cId, candidates) ->
                    val activeTotalForCampaign =
                        RoomInstancesTable
                            .selectAll()
                            .where {
                                (RoomInstancesTable.campaignId eq cId) and
                                    (RoomInstancesTable.isActive eq true)
                            }.count()
                            .toInt()

                    // How many we are allowed to deactivate while keeping keepMinimum alive.
                    val allowedToDeactivate = (activeTotalForCampaign - keepMinimum).coerceAtLeast(0)
                    val toDeactivate = candidates.take(allowedToDeactivate)

                    toDeactivate.forEach { shard ->
                        RoomInstancesTable.update({ RoomInstancesTable.id eq shard.id }) {
                            it[isActive] = false
                            it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
                        }
                    }
                }
        }

    override suspend fun updateViewerStats(
        campaignId: UUID,
        totalViewers: Int,
        totalInQueue: Int,
    ): Unit =
        newSuspendedTransaction {
            CampaignViewerStatsTable.upsert(CampaignViewerStatsTable.campaignId) {
                it[CampaignViewerStatsTable.campaignId] = campaignId
                it[CampaignViewerStatsTable.totalViewers] = totalViewers
                it[CampaignViewerStatsTable.totalInQueue] = totalInQueue
                it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }

    private fun ResultRow.toRoomInstance(): RoomInstance =
        RoomInstance(
            id = this[RoomInstancesTable.id],
            campaignId = this[RoomInstancesTable.campaignId],
            instanceNumber = this[RoomInstancesTable.instanceNumber],
            playerCount = this[RoomInstancesTable.playerCount],
            maxPlayers = this[RoomInstancesTable.maxPlayers],
            isActive = this[RoomInstancesTable.isActive],
            createdAt = this[RoomInstancesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[RoomInstancesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}
