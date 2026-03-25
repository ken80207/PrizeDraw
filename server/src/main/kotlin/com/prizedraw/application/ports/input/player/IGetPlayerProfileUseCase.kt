package com.prizedraw.application.ports.input.player

import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for retrieving a player's public profile.
 */
public interface IGetPlayerProfileUseCase {
    /**
     * Returns the player profile for the given [playerId].
     *
     * @param playerId The authenticated player's identifier.
     * @return The player's [PlayerDto].
     * @throws com.prizedraw.application.usecases.auth.PlayerNotFoundException if no active
     *   player exists with the given ID.
     */
    public suspend fun execute(playerId: PlayerId): PlayerDto
}
