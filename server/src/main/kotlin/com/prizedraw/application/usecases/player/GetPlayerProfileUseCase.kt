package com.prizedraw.application.usecases.player

import com.prizedraw.application.ports.input.player.IGetPlayerProfileUseCase
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.usecases.auth.PlayerNotFoundException
import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Retrieves the authenticated player's profile from the repository and maps it to a [PlayerDto].
 *
 * Follow counts are fetched concurrently with the player lookup via [IFollowRepository].
 */
public class GetPlayerProfileUseCase(
    private val playerRepository: IPlayerRepository,
    private val followRepository: IFollowRepository,
) : IGetPlayerProfileUseCase {
    override suspend fun execute(playerId: PlayerId): PlayerDto {
        val player =
            playerRepository.findById(playerId)
                ?: throw PlayerNotFoundException("Player $playerId not found")

        val rawId = playerId.value
        val followerCount = followRepository.countFollowers(rawId)
        val followingCount = followRepository.countFollowing(rawId)

        return PlayerDto(
            id = player.id.value.toString(),
            playerCode = player.playerCode,
            nickname = player.nickname,
            avatarUrl = player.avatarUrl,
            phoneNumber = player.phoneNumber?.value,
            drawPointsBalance = player.drawPointsBalance,
            revenuePointsBalance = player.revenuePointsBalance,
            preferredAnimationMode = player.preferredAnimationMode,
            locale = player.locale,
            isActive = player.isActive,
            createdAt = player.createdAt,
            followerCount = followerCount,
            followingCount = followingCount,
        )
    }
}
