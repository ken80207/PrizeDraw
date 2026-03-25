package com.prizedraw.api.mappers

import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.domain.entities.Player

/**
 * Maps a [Player] domain entity to its [PlayerDto] representation.
 *
 * Extension functions for mapping between [Player] domain entities and [PlayerDto] contracts.
 * Strips internal fields (version, deletedAt, oauthProvider, oauthSubject) that must not
 * be exposed via the public API contract.
 */
public fun Player.toDto(): PlayerDto =
    PlayerDto(
        id = id.value.toString(),
        nickname = nickname,
        avatarUrl = avatarUrl,
        phoneNumber = phoneNumber?.value,
        drawPointsBalance = drawPointsBalance,
        revenuePointsBalance = revenuePointsBalance,
        preferredAnimationMode = preferredAnimationMode,
        locale = locale,
        isActive = isActive,
        createdAt = createdAt,
    )
