package com.prizedraw.api.mappers

import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.domain.entities.Player

/**
 * Maps a [Player] domain entity to its [PlayerDto] representation.
 *
 * Extension functions for mapping between [Player] domain entities and [PlayerDto] contracts.
 * Strips internal fields (version, deletedAt, oauthProvider, oauthSubject) that must not
 * be exposed via the public API contract.
 *
 * @param followerCount Number of players following this player. Defaults to 0 when not needed.
 * @param followingCount Number of players this player follows. Defaults to 0 when not needed.
 */
public fun Player.toDto(
    followerCount: Int = 0,
    followingCount: Int = 0,
): PlayerDto =
    PlayerDto(
        id = id.value.toString(),
        playerCode = playerCode,
        nickname = nickname,
        avatarUrl = avatarUrl,
        phoneNumber = phoneNumber?.value,
        drawPointsBalance = drawPointsBalance,
        revenuePointsBalance = revenuePointsBalance,
        preferredAnimationMode = preferredAnimationMode,
        locale = locale,
        isActive = isActive,
        createdAt = createdAt,
        followerCount = followerCount,
        followingCount = followingCount,
    )
