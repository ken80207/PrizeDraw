package com.prizedraw.application.usecases.auth

import com.prizedraw.application.ports.input.auth.ILogoutUseCase
import com.prizedraw.application.services.TokenService
import com.prizedraw.contracts.dto.auth.LogoutRequest

/**
 * Revokes the refresh token family for the presented refresh token.
 *
 * The refresh token format is `{familyToken}:{rawToken}`. This use case extracts
 * the family token and delegates revocation to [TokenService.revokeFamily], which
 * invalidates all sessions sharing the same family.
 */
public class LogoutUseCase(
    private val tokenService: TokenService,
) : ILogoutUseCase {
    override suspend fun execute(request: LogoutRequest) {
        val parts = request.refreshToken.split(":", limit = 2)
        require(parts.size == 2) { "Malformed refresh token format" }
        val familyToken = parts[0]
        tokenService.revokeFamily(familyToken)
    }
}
