package com.prizedraw.application.usecases.player

import com.prizedraw.api.mappers.toDto
import com.prizedraw.application.ports.input.player.IGetPlayerProfileUseCase
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.usecases.auth.PlayerNotFoundException
import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Retrieves the authenticated player's profile from the repository and maps it to a [PlayerDto].
 */
public class GetPlayerProfileUseCase(
    private val playerRepository: IPlayerRepository,
) : IGetPlayerProfileUseCase {
    override suspend fun execute(playerId: PlayerId): PlayerDto {
        val player =
            playerRepository.findById(playerId)
                ?: throw PlayerNotFoundException("Player $playerId not found")
        return player.toDto()
    }
}
