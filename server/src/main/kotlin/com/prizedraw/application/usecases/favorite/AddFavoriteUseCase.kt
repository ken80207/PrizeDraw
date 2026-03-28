package com.prizedraw.application.usecases.favorite

import com.prizedraw.application.ports.input.favorite.IAddFavoriteUseCase
import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.CampaignFavorite
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock

/**
 * Adds a campaign to a player's favorites after verifying the campaign exists.
 *
 * Duplicate inserts are handled via INSERT IGNORE semantics in the repository,
 * making the operation naturally idempotent.
 */
public class AddFavoriteUseCase(
    private val favoriteRepository: ICampaignFavoriteRepository,
    private val campaignRepository: ICampaignRepository,
) : IAddFavoriteUseCase {
    override suspend fun execute(
        playerId: PlayerId,
        campaignType: CampaignType,
        campaignId: CampaignId,
    ) {
        val exists =
            when (campaignType) {
                CampaignType.KUJI -> campaignRepository.findKujiById(campaignId) != null
                CampaignType.UNLIMITED -> campaignRepository.findUnlimitedById(campaignId) != null
            }

        require(exists) {
            "Campaign $campaignId of type $campaignType not found"
        }

        favoriteRepository.save(
            CampaignFavorite(
                playerId = playerId,
                campaignType = campaignType,
                campaignId = campaignId,
                createdAt = Clock.System.now(),
            ),
        )
    }
}
