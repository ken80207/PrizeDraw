package com.prizedraw.application.usecases.player

import com.prizedraw.api.mappers.toDto
import com.prizedraw.application.ports.input.player.IUpdatePlayerProfileUseCase
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.usecases.auth.PlayerNotFoundException
import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.contracts.dto.player.UpdatePlayerRequest
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock

/**
 * Applies validated profile mutations to a player and persists the updated entity.
 *
 * Validation rules:
 * - [UpdatePlayerRequest.nickname]: 1–64 characters when provided.
 * - [UpdatePlayerRequest.locale]: must match BCP-47 pattern `xx` or `xx-XX` when provided.
 */
public class UpdatePlayerProfileUseCase(
    private val playerRepository: IPlayerRepository,
) : IUpdatePlayerProfileUseCase {
    override suspend fun execute(
        playerId: PlayerId,
        request: UpdatePlayerRequest,
    ): PlayerDto {
        val player =
            playerRepository.findById(playerId)
                ?: throw PlayerNotFoundException("Player $playerId not found")

        request.nickname?.let { nickname ->
            require(nickname.isNotBlank() && nickname.length <= MAX_NICKNAME_LENGTH) {
                "Nickname must be 1–$MAX_NICKNAME_LENGTH characters"
            }
        }

        request.locale?.let { locale ->
            require(BCP47_REGEX.matches(locale)) {
                "Locale must follow BCP-47 format (e.g. zh-TW, en, en-US)"
            }
        }

        val updated =
            playerRepository.save(
                player.copy(
                    nickname = request.nickname ?: player.nickname,
                    avatarUrl = request.avatarUrl ?: player.avatarUrl,
                    locale = request.locale ?: player.locale,
                    updatedAt = Clock.System.now(),
                ),
            )

        return updated.toDto()
    }

    private companion object {
        const val MAX_NICKNAME_LENGTH = 64

        /** Matches BCP-47 language tags like `zh`, `zh-TW`, `en-US`. */
        val BCP47_REGEX = Regex("""^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$""")
    }
}
