package com.prizedraw.application.ports.input.auth

import com.prizedraw.contracts.dto.auth.LogoutRequest

/**
 * Input port for player logout.
 *
 * Revokes the entire refresh token family derived from the presented refresh token,
 * invalidating all sessions sharing the same family.
 */
public interface ILogoutUseCase {
    /**
     * Revokes the refresh token family for the presented token.
     *
     * @param request Logout request carrying the refresh token to revoke.
     */
    public suspend fun execute(request: LogoutRequest)
}
