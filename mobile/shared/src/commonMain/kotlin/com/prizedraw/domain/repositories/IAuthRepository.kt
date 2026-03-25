package com.prizedraw.domain.repositories

import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.contracts.enums.OAuthProvider

/**
 * Domain repository interface for authentication operations.
 *
 * Abstracts over network and local storage so that use cases remain testable
 * without real HTTP or DataStore dependencies.
 */
public interface IAuthRepository {
    /**
     * Authenticates via the given OAuth provider and ID token.
     *
     * @param provider The OAuth2 provider (Google, Apple, LINE).
     * @param idToken The provider-issued ID token.
     * @return The authenticated player's profile.
     */
    public suspend fun login(
        provider: OAuthProvider,
        idToken: String,
    ): PlayerDto

    /** Sends an OTP to [phoneNumber] for verification. */
    public suspend fun sendOtp(phoneNumber: String)

    /**
     * Binds the phone number to the authenticated player after OTP verification.
     *
     * @param phoneNumber E.164-format phone number.
     * @param otpCode The 6-digit OTP code.
     * @return The updated player profile.
     */
    public suspend fun bindPhone(
        phoneNumber: String,
        otpCode: String,
    ): PlayerDto

    /** Revokes the current session's refresh token family and clears local tokens. */
    public suspend fun logout()

    /**
     * Rotates the stored refresh token.
     *
     * @return True if the refresh succeeded; false if the session has expired.
     */
    public suspend fun refreshToken(): Boolean

    /** Returns the stored access token, or null if unauthenticated. */
    public suspend fun getAccessToken(): String?
}
