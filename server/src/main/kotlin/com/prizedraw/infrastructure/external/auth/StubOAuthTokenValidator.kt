package com.prizedraw.infrastructure.external.auth

import com.prizedraw.application.ports.output.IOAuthTokenValidator
import com.prizedraw.application.ports.output.OAuthValidationResult
import com.prizedraw.contracts.enums.OAuthProvider
import org.slf4j.LoggerFactory

/**
 * Stub implementation of [IOAuthTokenValidator] for local development and testing.
 *
 * Treats any non-blank ID token as valid and derives a deterministic subject from
 * the token string. Replace with a real JWKS-based validator (Google, Apple, LINE)
 * before deploying to production.
 *
 * In development the subject returned is `stub:{provider.name}:{idToken}` truncated
 * to 128 characters, ensuring consistent player identity across re-runs.
 */
public class StubOAuthTokenValidator : IOAuthTokenValidator {
    private val log = LoggerFactory.getLogger(StubOAuthTokenValidator::class.java)

    override suspend fun validate(
        provider: OAuthProvider,
        idToken: String,
    ): OAuthValidationResult {
        require(idToken.isNotBlank()) { "ID token must not be blank" }
        log.warn(
            "StubOAuthTokenValidator validating token for provider {} — not performing real JWKS verification",
            provider,
        )
        val subject = "stub:${provider.name}:$idToken".take(MAX_SUBJECT_LENGTH)
        return OAuthValidationResult(
            subject = subject,
            email = null,
            name = null,
        )
    }

    private companion object {
        const val MAX_SUBJECT_LENGTH = 128
    }
}
