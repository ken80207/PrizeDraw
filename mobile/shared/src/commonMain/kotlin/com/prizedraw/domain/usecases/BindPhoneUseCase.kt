package com.prizedraw.domain.usecases

import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.domain.repositories.IAuthRepository

/**
 * Client-side use case for phone number binding.
 *
 * Validates the OTP via the server and updates the local player profile.
 *
 * TODO(T093): Implement after [IAuthRepository] is wired with real data sources.
 */
public class BindPhoneUseCase(
    private val authRepository: IAuthRepository,
) {
    /**
     * Sends the OTP to the server for verification and binds the phone number.
     *
     * @param phoneNumber E.164-format phone number entered by the user.
     * @param otpCode The 6-digit OTP code entered by the user.
     * @return The updated [PlayerDto] with `isActive=true` and phone bound.
     */
    public suspend fun execute(
        phoneNumber: String,
        otpCode: String,
    ): PlayerDto {
        TODO("T093: implement — delegate to authRepository.bindPhone(phoneNumber, otpCode)")
    }
}
