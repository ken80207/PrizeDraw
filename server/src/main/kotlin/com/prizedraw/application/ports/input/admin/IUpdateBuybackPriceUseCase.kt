package com.prizedraw.application.ports.input.admin

import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.StaffId

/**
 * Input port for updating the buyback price on a [PrizeDefinition].
 *
 * Records an [com.prizedraw.domain.entities.AuditLog] entry with before/after values.
 * Validates [buybackPrice] >= 0.
 */
public interface IUpdateBuybackPriceUseCase {
    /**
     * Updates [PrizeDefinition.buybackPrice] and [PrizeDefinition.buybackEnabled].
     *
     * @param staffId The staff member performing the update.
     * @param prizeDefinitionId The prize definition to update.
     * @param buybackPrice New buyback price in revenue points. Must be >= 0.
     * @param buybackEnabled Whether buyback is enabled for this prize grade.
     * @return The updated [PrizeDefinition].
     */
    public suspend fun execute(
        staffId: StaffId,
        prizeDefinitionId: PrizeDefinitionId,
        buybackPrice: Int,
        buybackEnabled: Boolean,
    ): PrizeDefinition
}
