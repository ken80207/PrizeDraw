package com.prizedraw.application.ports.input.auth

import com.prizedraw.contracts.dto.auth.RefreshRequest
import com.prizedraw.contracts.dto.auth.TokenResponse

/**
 * Input port for rotating a refresh token into a new token pair.
 *
 * Implements the refresh token rotation strategy. If a previously-consumed token is
 * presented (replay attack), the entire family is revoked and an auth exception is thrown.
 */
public interface IRefreshTokenUseCase {
    /**
     * Rotates the presented refresh token and issues a new access + refresh token pair.
     *
     * @param request Request carrying the current refresh token.
     * @return A new [TokenResponse] with a rotated token pair.
     * @throws com.prizedraw.application.usecases.auth.AuthException if the token is invalid or
     *   a replay attack is detected (triggers full family revocation).
     */
    public suspend fun execute(request: RefreshRequest): TokenResponse
}
