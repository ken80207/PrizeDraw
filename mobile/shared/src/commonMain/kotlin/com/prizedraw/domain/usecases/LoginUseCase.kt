package com.prizedraw.domain.usecases

import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.domain.repositories.IAuthRepository

/**
 * Client-side use case for initiating OAuth social login.
 *
 * Orchestrates [IAuthRepository.login] + token storage, and returns the player profile.
 * Callers (typically a ViewModel) should handle any thrown exceptions by transitioning
 * the UI to an error state.
 *
 * TODO(T093): Implement after [IAuthRepository] is wired with real data sources.
 */
public class LoginUseCase(
    private val authRepository: IAuthRepository,
) {
    /**
     * Authenticates via the given OAuth provider and stores the resulting token pair.
     *
     * @param provider The OAuth2 provider (Google, Apple, LINE).
     * @param idToken The raw ID token from the native OAuth SDK.
     * @return The authenticated [PlayerDto].
     */
    public suspend fun execute(
        provider: OAuthProvider,
        idToken: String,
    ): PlayerDto {
        TODO("T093: implement — delegate to authRepository.login(provider, idToken)")
    }
}
