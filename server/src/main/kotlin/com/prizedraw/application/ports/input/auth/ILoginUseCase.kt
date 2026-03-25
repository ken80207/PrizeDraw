package com.prizedraw.application.ports.input.auth

import com.prizedraw.contracts.dto.auth.LoginRequest
import com.prizedraw.contracts.dto.auth.TokenResponse

/**
 * Input port for OAuth2 social login.
 *
 * Validates the provider-issued ID token, finds or creates the [com.prizedraw.domain.entities.Player]
 * by OAuth subject, and issues a JWT token pair.
 */
public interface ILoginUseCase {
    /**
     * Executes the login flow for the given OAuth request.
     *
     * @param request Login request carrying the OAuth provider and ID token.
     * @return A [TokenResponse] containing the access token, refresh token, and expiry.
     */
    public suspend fun execute(request: LoginRequest): TokenResponse
}
