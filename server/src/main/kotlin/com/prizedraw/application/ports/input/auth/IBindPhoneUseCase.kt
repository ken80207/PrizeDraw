package com.prizedraw.application.ports.input.auth

import com.prizedraw.contracts.dto.auth.PhoneBindRequest
import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for binding a verified phone number to a player account.
 *
 * Validates the OTP stored in Redis, checks uniqueness of the phone number across
 * all players, and sets [com.prizedraw.domain.entities.Player.isActive] to true once
 * verified.
 */
public interface IBindPhoneUseCase {
    /**
     * Binds the phone number to the player account after OTP verification.
     *
     * @param playerId The authenticated player to update.
     * @param request Request carrying the phone number and OTP code.
     * @return The updated [PlayerDto] with the verified phone number and active status.
     * @throws com.prizedraw.application.usecases.auth.OtpInvalidException if the OTP is
     *   incorrect or expired.
     * @throws com.prizedraw.application.usecases.auth.PhoneAlreadyBoundException if the
     *   phone number is already associated with another player account.
     */
    public suspend fun execute(
        playerId: PlayerId,
        request: PhoneBindRequest,
    ): PlayerDto
}
