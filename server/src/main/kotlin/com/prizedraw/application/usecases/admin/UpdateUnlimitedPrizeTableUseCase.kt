package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ISystemSettingsRepository
import com.prizedraw.contracts.dto.admin.UpdatePrizeTableRequest
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.services.MarginResult
import com.prizedraw.domain.services.MarginRiskService
import com.prizedraw.domain.services.UnlimitedPrizeInput
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock

/**
 * Replaces the entire prize table for an unlimited campaign (DRAFT only).
 * Validates probability sum = 1,000,000 bps and returns margin analysis.
 */
public class UpdateUnlimitedPrizeTableUseCase(
    private val campaignRepository: ICampaignRepository,
    private val prizeRepository: IPrizeRepository,
    private val marginRiskService: MarginRiskService,
    private val settingsRepository: ISystemSettingsRepository,
) {
    /**
     * Replaces all prize definitions for the given unlimited campaign.
     *
     * @param campaignId The unlimited campaign ID.
     * @param request The new prize table (full replacement).
     * @param staffId The staff member performing the update.
     * @return Margin analysis result.
     * @throws IllegalStateException if campaign is not in DRAFT status.
     * @throws IllegalArgumentException if probability sum != 1,000,000 or entries invalid.
     */
    public suspend fun execute(
        campaignId: CampaignId,
        request: UpdatePrizeTableRequest,
        staffId: StaffId,
    ): MarginResult {
        val campaign = campaignRepository.findUnlimitedById(campaignId)
            ?: error("Unlimited campaign not found: $campaignId")

        check(campaign.status == CampaignStatus.DRAFT) {
            "Prize table can only be updated in DRAFT status, current: ${campaign.status}"
        }

        val totalBps = request.prizeTable.sumOf { it.probabilityBps }
        require(totalBps == 1_000_000) {
            "Probability sum must be exactly 1,000,000 bps (100%), got: $totalBps"
        }

        request.prizeTable.forEach { entry ->
            require(entry.prizeValue >= 0) { "prizeValue must be >= 0" }
            require(entry.probabilityBps > 0) { "probabilityBps must be > 0" }
            require(entry.grade.isNotBlank()) { "grade must not be blank" }
            require(entry.name.isNotBlank()) { "name must not be blank" }
        }

        val now = Clock.System.now()

        prizeRepository.deleteByUnlimitedCampaignId(campaignId)

        val definitions = request.prizeTable.map { entry ->
            PrizeDefinition(
                id = PrizeDefinitionId.generate(),
                kujiCampaignId = null,
                unlimitedCampaignId = campaignId,
                grade = entry.grade,
                name = entry.name,
                photos = listOfNotNull(entry.photoUrl),
                prizeValue = entry.prizeValue,
                buybackPrice = 0,
                buybackEnabled = true,
                probabilityBps = entry.probabilityBps,
                ticketCount = null,
                displayOrder = entry.displayOrder,
                createdAt = now,
                updatedAt = now,
            )
        }
        prizeRepository.saveAll(definitions)

        val threshold = settingsRepository.getMarginThresholdPct()
        return marginRiskService.calculateUnlimitedMargin(
            pricePerDraw = campaign.pricePerDraw,
            prizes = definitions.map {
                UnlimitedPrizeInput(
                    probabilityBps = it.probabilityBps!!,
                    prizeValue = it.prizeValue,
                )
            },
            thresholdPct = threshold,
        )
    }
}
