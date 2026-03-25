package com.prizedraw.application.ports.input.buyback

import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId

/**
 * Input port for official platform buyback of a player's HOLDING prize.
 *
 * The buyback price is snapshotted from [com.prizedraw.domain.entities.PrizeDefinition]
 * at submission time. Revenue points are credited atomically in the same transaction.
 */
public interface IBuybackUseCase {
    /**
     * Executes a buyback for the given prize instance, crediting revenue points to the player.
     *
     * @param playerId       The player requesting the buyback.
     * @param prizeInstanceId The prize instance to recycle.
     * @return The revenue points credited (the snapshotted buyback price).
     */
    public suspend fun execute(
        playerId: PlayerId,
        prizeInstanceId: PrizeInstanceId,
    ): Int
}

/**
 * Input port for previewing the buyback price without committing the transaction.
 */
public interface IGetBuybackPriceUseCase {
    /**
     * Returns the current buyback price for the given prize instance.
     *
     * @param playerId       The owning player (for ownership validation).
     * @param prizeInstanceId The prize instance to preview.
     * @return The current buyback price in revenue points.
     */
    public suspend fun execute(
        playerId: PlayerId,
        prizeInstanceId: PrizeInstanceId,
    ): Int
}
