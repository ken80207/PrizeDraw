package com.prizedraw.application.ports.input.player

import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for updating a player's preferred draw animation mode.
 *
 * The preference is persisted and returned in the player profile on every
 * subsequent [PlayerDto] response so clients can restore the last-chosen mode.
 */
public interface IUpdateAnimationPreferenceUseCase {
    /**
     * Updates [playerId]'s preferred animation mode to [mode].
     *
     * @param playerId The authenticated player.
     * @param mode The desired animation mode.
     * @return Updated [PlayerDto] with the new preference applied.
     */
    public suspend fun execute(
        playerId: PlayerId,
        mode: DrawAnimationMode,
    ): PlayerDto
}
