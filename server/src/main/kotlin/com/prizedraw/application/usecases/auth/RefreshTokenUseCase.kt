package com.prizedraw.application.usecases.auth

import com.prizedraw.application.ports.input.auth.IRefreshTokenUseCase
import com.prizedraw.application.services.TokenException
import com.prizedraw.application.services.TokenReplayException
import com.prizedraw.application.services.TokenService
import com.prizedraw.contracts.dto.auth.RefreshRequest
import com.prizedraw.contracts.dto.auth.TokenResponse

/**
 * Rotates a refresh token and issues a new access + refresh token pair.
 *
 * Delegates entirely to [TokenService.rotateRefreshToken].
 * On [TokenReplayException] the entire refresh token family has been revoked by
 * [TokenService] and an [AuthException] is re-thrown so the route layer can return 401.
 */
public class RefreshTokenUseCase(
    private val tokenService: TokenService,
) : IRefreshTokenUseCase {
    override suspend fun execute(request: RefreshRequest): TokenResponse {
        val tokenPair =
            try {
                tokenService.rotateRefreshToken(request.refreshToken)
            } catch (e: TokenReplayException) {
                throw AuthException("Refresh token replay detected — all sessions revoked", e)
            } catch (e: TokenException) {
                throw AuthException("Refresh token invalid or expired: ${e.message}", e)
            }

        return TokenResponse(
            accessToken = tokenPair.accessToken,
            refreshToken = tokenPair.refreshToken,
            expiresIn = ACCESS_TOKEN_EXPIRES_IN_SECONDS,
        )
    }

    private companion object {
        const val ACCESS_TOKEN_EXPIRES_IN_SECONDS = 900L
    }
}
