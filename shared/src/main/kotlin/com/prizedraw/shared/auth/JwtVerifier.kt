package com.prizedraw.shared.auth

import com.nimbusds.jose.crypto.MACVerifier
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import org.slf4j.LoggerFactory
import java.util.Date
import java.util.UUID

/**
 * Verified claims extracted from a player access token.
 *
 * @property playerId The player's UUID, parsed from the JWT `sub` claim.
 * @property issuer The JWT `iss` claim value.
 * @property expiresAt Expiry instant from the JWT `exp` claim.
 */
public data class PlayerClaims(
    val playerId: UUID,
    val issuer: String,
    val expiresAt: Date,
)

/**
 * Verified claims extracted from a staff access token.
 *
 * @property staffId The staff member's UUID, parsed from the JWT `sub` claim.
 * @property role The staff role string from the `role` claim.
 * @property issuer The JWT `iss` claim value.
 * @property expiresAt Expiry instant from the JWT `exp` claim.
 */
public data class StaffClaims(
    val staffId: UUID,
    val role: String,
    val issuer: String,
    val expiresAt: Date,
)

/**
 * Shared JWT verification utility for microservices.
 *
 * Each service instantiates [JwtVerifier] with the shared HMAC secret and expected issuer.
 * Verification is purely local — no HTTP calls to an auth service are required.
 *
 * Token format:
 * - Player tokens: HS256-signed JWT with `sub` = player UUID string.
 * - Staff tokens: HS256-signed JWT with `sub` = staff UUID string and custom `role` claim.
 *
 * @param jwtSecret The HS256 signing secret. Must match the value used by the issuing service.
 * @param expectedIssuer The expected `iss` claim value (e.g. `"prizedraw"`).
 */
public class JwtVerifier(
    jwtSecret: String,
    private val expectedIssuer: String = DEFAULT_ISSUER,
) {
    private val verifier = MACVerifier(jwtSecret.toByteArray(Charsets.UTF_8))
    private val log = LoggerFactory.getLogger(JwtVerifier::class.java)

    /**
     * Verifies a player access token and returns the extracted [PlayerClaims].
     *
     * Returns `null` when:
     * - The token cannot be parsed as a signed JWT.
     * - The HMAC signature is invalid.
     * - The `exp` claim is in the past.
     * - The `iss` claim does not match [expectedIssuer].
     * - The `sub` claim is missing or not a valid UUID.
     *
     * @param token Raw JWT string from the `Authorization: Bearer <token>` header.
     * @return Extracted [PlayerClaims], or `null` if verification fails.
     */
    @Suppress("ReturnCount", "TooGenericExceptionCaught")
    public fun verifyPlayerToken(token: String): PlayerClaims? =
        runCatching {
            val jwt = parseAndVerify(token) ?: return null
            val claims = jwt.jwtClaimsSet
            val subject =
                claims.subject
                    ?: run {
                        log.debug("Player token missing sub claim")
                        return null
                    }
            val playerId =
                runCatching {
                    UUID.fromString(subject)
                }.getOrElse {
                    log.debug("Player token sub is not a valid UUID: {}", subject)
                    return null
                }
            PlayerClaims(
                playerId = playerId,
                issuer = claims.issuer,
                expiresAt = claims.expirationTime,
            )
        }.onFailure { log.debug("Player token verification failed: {}", it.message) }
            .getOrNull()

    /**
     * Verifies a staff access token and returns the extracted [StaffClaims].
     *
     * In addition to the checks performed by [verifyPlayerToken], this method also
     * requires the `role` custom claim to be present.
     *
     * Returns `null` when:
     * - Any of the base JWT checks fail (see [verifyPlayerToken]).
     * - The `role` claim is absent or blank.
     *
     * @param token Raw JWT string from the `Authorization: Bearer <token>` header.
     * @return Extracted [StaffClaims], or `null` if verification fails.
     */
    @Suppress("ReturnCount", "TooGenericExceptionCaught")
    public fun verifyStaffToken(token: String): StaffClaims? =
        runCatching {
            val jwt = parseAndVerify(token) ?: return null
            val claims = jwt.jwtClaimsSet
            val subject =
                claims.subject
                    ?: run {
                        log.debug("Staff token missing sub claim")
                        return null
                    }
            val staffId =
                runCatching {
                    UUID.fromString(subject)
                }.getOrElse {
                    log.debug("Staff token sub is not a valid UUID: {}", subject)
                    return null
                }
            val role =
                claims.getStringClaim("role")?.takeIf { it.isNotBlank() }
                    ?: run {
                        log.debug("Staff token missing or blank role claim")
                        return null
                    }
            StaffClaims(
                staffId = staffId,
                role = role,
                issuer = claims.issuer,
                expiresAt = claims.expirationTime,
            )
        }.onFailure { log.debug("Staff token verification failed: {}", it.message) }
            .getOrNull()

    /**
     * Parses and performs the shared validation steps common to both token types:
     * signature verification, expiry check, and issuer check.
     *
     * @return A verified [SignedJWT] with valid claims, or `null` on any failure.
     */
    @Suppress("ReturnCount")
    private fun parseAndVerify(token: String): SignedJWT? {
        val jwt =
            runCatching {
                SignedJWT.parse(token)
            }.getOrElse {
                log.debug("JWT parse failed: {}", it.message)
                return null
            }
        if (!jwt.verify(verifier)) {
            log.debug("JWT signature verification failed")
            return null
        }
        val claims: JWTClaimsSet = jwt.jwtClaimsSet
        val expiry = claims.expirationTime
        if (expiry == null || expiry.before(Date())) {
            log.debug("JWT expired at {}", expiry)
            return null
        }
        if (claims.issuer != expectedIssuer) {
            log.debug("JWT issuer mismatch: expected={}, actual={}", expectedIssuer, claims.issuer)
            return null
        }
        return jwt
    }

    private companion object {
        const val DEFAULT_ISSUER = "prizedraw"
    }
}
