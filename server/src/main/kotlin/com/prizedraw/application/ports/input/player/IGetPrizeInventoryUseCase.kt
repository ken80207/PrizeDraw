package com.prizedraw.application.ports.input.player

import com.prizedraw.contracts.dto.prize.PrizeInstanceDto
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId

/**
 * Input port for retrieving a player's prize inventory.
 */
public interface IGetPrizeInventoryUseCase {
    /**
     * Returns all active prizes owned by [playerId], enriched with definition info.
     *
     * Includes instances in states: HOLDING, TRADING, EXCHANGING, PENDING_SHIPMENT, SHIPPED.
     *
     * @param playerId The authenticated player's identifier.
     * @return List of enriched prize instance DTOs.
     */
    public suspend fun list(playerId: PlayerId): List<PrizeInstanceDto>

    /**
     * Returns a single prize instance owned by [playerId].
     *
     * @param playerId The authenticated player's identifier.
     * @param instanceId The prize instance to retrieve.
     * @return The enriched [PrizeInstanceDto].
     * @throws PrizeNotFoundException if the instance does not exist or is not owned by the player.
     */
    public suspend fun getOne(
        playerId: PlayerId,
        instanceId: PrizeInstanceId,
    ): PrizeInstanceDto
}
