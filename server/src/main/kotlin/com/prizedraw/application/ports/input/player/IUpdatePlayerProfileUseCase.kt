package com.prizedraw.application.ports.input.player

import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.contracts.dto.player.UpdatePlayerRequest
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for updating a player's mutable profile fields.
 *
 * Validates that:
 * - [UpdatePlayerRequest.nickname] is between 1 and 64 characters when provided.
 * - [UpdatePlayerRequest.locale] follows BCP-47 format when provided.
 */
public interface IUpdatePlayerProfileUseCase {
    /**
     * Applies the requested profile updates to the player.
     *
     * @param playerId The authenticated player's identifier.
     * @param request The set of optional fields to update.
     * @return The updated [PlayerDto] reflecting the applied changes.
     * @throws com.prizedraw.application.usecases.auth.PlayerNotFoundException if no active
     *   player exists with the given ID.
     * @throws IllegalArgumentException if any provided field fails validation.
     */
    public suspend fun execute(
        playerId: PlayerId,
        request: UpdatePlayerRequest,
    ): PlayerDto
}
