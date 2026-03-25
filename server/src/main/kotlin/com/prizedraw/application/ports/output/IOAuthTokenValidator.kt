package com.prizedraw.application.ports.output

import com.prizedraw.contracts.enums.OAuthProvider

/**
 * Result of a successful OAuth ID token validation.
 *
 * @property subject The provider-issued user identifier (`sub` claim).
 * @property email Optional email claim, if provided by the token.
 * @property name Optional display name claim, if provided by the token.
 */
public data class OAuthValidationResult(
    val subject: String,
    val email: String?,
    val name: String?,
)

/**
 * Output port for verifying OAuth2 provider ID tokens.
 *
 * Implementations validate tokens against the issuer's JWKS endpoint (Google, Apple, LINE).
 * The contract returns the validated subject claim which is used to find or create a
 * [com.prizedraw.domain.entities.Player].
 */
public interface IOAuthTokenValidator {
    /**
     * Validates the given ID token against the specified OAuth provider.
     *
     * @param provider The OAuth2 provider that issued the token.
     * @param idToken The raw ID token string from the client.
     * @return An [OAuthValidationResult] containing the validated subject and optional claims.
     * @throws com.prizedraw.application.usecases.auth.AuthException if the token is invalid,
     *   expired, or cannot be verified against the provider's public keys.
     */
    public suspend fun validate(
        provider: OAuthProvider,
        idToken: String,
    ): OAuthValidationResult
}
