package com.prizedraw.application.usecases.player

import com.prizedraw.api.mappers.toDto
import com.prizedraw.application.ports.input.player.IUpdateAnimationPreferenceUseCase
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.usecases.auth.PlayerNotFoundException
import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock

/**
 * Persists a player's preferred draw animation mode.
 *
 * The updated preference is immediately visible in the next profile response so that
 * all clients can restore the chosen animation without a separate flag query.
 */
public class UpdateAnimationPreferenceUseCase(
    private val playerRepository: IPlayerRepository,
) : IUpdateAnimationPreferenceUseCase {
    override suspend fun execute(
        playerId: PlayerId,
        mode: DrawAnimationMode,
    ): PlayerDto {
        val player =
            playerRepository.findById(playerId)
                ?: throw PlayerNotFoundException("Player $playerId not found")

        val updated =
            playerRepository.save(
                player.copy(
                    preferredAnimationMode = mode,
                    updatedAt = Clock.System.now(),
                ),
            )
        return updated.toDto()
    }
}
