package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.CampaignFavorite
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.infrastructure.persistence.inTransaction
import com.prizedraw.infrastructure.persistence.tables.CampaignFavoritesTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.deleteWhere
import org.jetbrains.exposed.sql.insertIgnore
import org.jetbrains.exposed.sql.selectAll
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** Exposed-backed implementation of [ICampaignFavoriteRepository]. */
public class CampaignFavoriteRepositoryImpl : ICampaignFavoriteRepository {
    override suspend fun save(favorite: CampaignFavorite): Unit =
        inTransaction {
            CampaignFavoritesTable.insertIgnore {
                it[playerId] = favorite.playerId.value
                it[campaignType] = favorite.campaignType.name
                it[campaignId] = favorite.campaignId.value
                it[createdAt] = OffsetDateTime.ofInstant(favorite.createdAt.toJavaInstant(), ZoneOffset.UTC)
            }
        }

    override suspend fun delete(
        playerId: UUID,
        campaignType: CampaignType,
        campaignId: UUID,
    ): Unit =
        inTransaction {
            CampaignFavoritesTable.deleteWhere {
                (CampaignFavoritesTable.playerId eq playerId) and
                    (CampaignFavoritesTable.campaignType eq campaignType.name) and
                    (CampaignFavoritesTable.campaignId eq campaignId)
            }
        }

    override suspend fun findByPlayerId(
        playerId: UUID,
        campaignType: CampaignType?,
        limit: Int,
        offset: Int,
    ): List<CampaignFavorite> =
        inTransaction {
            CampaignFavoritesTable
                .selectAll()
                .where {
                    val base = CampaignFavoritesTable.playerId eq playerId
                    if (campaignType != null) {
                        base and (CampaignFavoritesTable.campaignType eq campaignType.name)
                    } else {
                        base
                    }
                }.orderBy(CampaignFavoritesTable.createdAt, SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toCampaignFavorite() }
        }

    override suspend fun countByPlayerId(
        playerId: UUID,
        campaignType: CampaignType?,
    ): Int =
        inTransaction {
            CampaignFavoritesTable
                .selectAll()
                .where {
                    val base = CampaignFavoritesTable.playerId eq playerId
                    if (campaignType != null) {
                        base and (CampaignFavoritesTable.campaignType eq campaignType.name)
                    } else {
                        base
                    }
                }.count()
                .toInt()
        }

    override suspend fun findPlayerIdsByCampaign(
        campaignType: CampaignType,
        campaignId: CampaignId,
    ): List<UUID> =
        inTransaction {
            CampaignFavoritesTable
                .select(CampaignFavoritesTable.playerId)
                .where {
                    (CampaignFavoritesTable.campaignType eq campaignType.name) and
                        (CampaignFavoritesTable.campaignId eq campaignId.value)
                }.map { it[CampaignFavoritesTable.playerId] }
        }

    override suspend fun isFavorited(
        playerId: UUID,
        campaignType: CampaignType,
        campaignId: UUID,
    ): Boolean =
        inTransaction {
            CampaignFavoritesTable
                .selectAll()
                .where {
                    (CampaignFavoritesTable.playerId eq playerId) and
                        (CampaignFavoritesTable.campaignType eq campaignType.name) and
                        (CampaignFavoritesTable.campaignId eq campaignId)
                }.count() > 0
        }

    override suspend fun findFavoritedCampaignIds(
        playerId: UUID,
        campaignType: CampaignType,
        campaignIds: List<UUID>,
    ): Set<UUID> {
        if (campaignIds.isEmpty()) {
            return emptySet()
        }
        return inTransaction {
            CampaignFavoritesTable
                .select(CampaignFavoritesTable.campaignId)
                .where {
                    (CampaignFavoritesTable.playerId eq playerId) and
                        (CampaignFavoritesTable.campaignType eq campaignType.name) and
                        (CampaignFavoritesTable.campaignId inList campaignIds)
                }.map { it[CampaignFavoritesTable.campaignId] }
                .toSet()
        }
    }

    private fun ResultRow.toCampaignFavorite(): CampaignFavorite =
        CampaignFavorite(
            playerId = PlayerId(this[CampaignFavoritesTable.playerId]),
            campaignType = CampaignType.valueOf(this[CampaignFavoritesTable.campaignType]),
            campaignId = CampaignId(this[CampaignFavoritesTable.campaignId]),
            createdAt = this[CampaignFavoritesTable.createdAt].toInstant().toKotlinInstant(),
        )
}
