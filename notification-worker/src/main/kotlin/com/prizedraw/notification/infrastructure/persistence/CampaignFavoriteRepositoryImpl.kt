package com.prizedraw.notification.infrastructure.persistence

import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.notification.ports.ICampaignFavoriteRepository
import com.prizedraw.schema.tables.CampaignFavoritesTable
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.select
import java.util.UUID

/**
 * Exposed-backed implementation of [ICampaignFavoriteRepository].
 *
 * Implements only [findPlayerIdsByCampaign] — the single method required for
 * low-stock notification fan-out — to keep the footprint minimal.
 */
public class CampaignFavoriteRepositoryImpl : ICampaignFavoriteRepository {
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
}
