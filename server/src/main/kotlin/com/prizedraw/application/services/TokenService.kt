package com.prizedraw.application.services

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.MACSigner
import com.nimbusds.jose.crypto.MACVerifier
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import com.prizedraw.domain.entities.RefreshTokenFamily
import com.prizedraw.domain.entities.TokenActorType
import com.prizedraw.domain.valueobjects.PlayerId
import org.slf4j.LoggerFactory
import java.security.MessageDigest
import java.time.Instant
import java.util.Date
import java.util.UUID

/**
 * JWT access and refresh token management with family-level revocation.
 *
 * Access tokens are short-lived (15 minutes by default) JWTs signed with HS256.
 * Refresh tokens are opaque random tokens bound to a [RefreshTokenFamily] row that
 * stores only the SHA-256 hash. On rotation, the hash is updated. If a previously-
 * consumed token is presented (replay attack), the entire family is revoked.
 *
 * @param config Token service configuration.
 * @param refreshTokenFamilyStore Persistence operations for [RefreshTokenFamily].
 */
public class TokenService(
    private val config: TokenConfig,
    private val refreshTokenFamilyStore: RefreshTokenFamilyStore,
) {
    public data class TokenConfig(
        /** HS256 secret key — must be at least 256 bits (32 bytes). */
        val jwtSecret: String,
        /** Access token validity in seconds. */
        val accessTokenTtlSeconds: Long = DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
        /** Refresh token family validity in days. */
        val refreshTokenFamilyTtlDays: Long = DEFAULT_REFRESH_TOKEN_FAMILY_TTL_DAYS,
        /** JWT issuer claim. */
        val issuer: String = "prizedraw",
    )

    /** Minimal persistence interface — injected by the DI module. */
    public interface RefreshTokenFamilyStore {
        suspend fun findByFamilyToken(familyToken: String): RefreshTokenFamily?

        suspend fun save(family: RefreshTokenFamily): RefreshTokenFamily

        suspend fun revokeFamily(familyToken: String)
    }

    public data class TokenPair(
        val accessToken: String,
        val refreshToken: String,
        val familyToken: String,
    )

    private val log = LoggerFactory.getLogger(TokenService::class.java)
    private val signer = MACSigner(config.jwtSecret.toByteArray(Charsets.UTF_8))
    private val verifier = MACVerifier(config.jwtSecret.toByteArray(Charsets.UTF_8))

    /**
     * Creates a new access + refresh token pair for the given [playerId].
     *
     * A new [RefreshTokenFamily] row is created, establishing a fresh login session.
     */
    public suspend fun createTokenPair(playerId: PlayerId): TokenPair {
        val familyToken = UUID.randomUUID().toString()
        val rawRefreshToken = UUID.randomUUID().toString()
        val tokenHash = sha256Hex(rawRefreshToken)

        val now = Instant.now()
        val family =
            RefreshTokenFamily(
                id = UUID.randomUUID(),
                // C-2 fix: store the opaque familyToken on the entity so the repository persists it
                familyToken = familyToken,
                actorType = TokenActorType.PLAYER,
                playerId = playerId,
                staffId = null,
                currentTokenHash = tokenHash,
                isRevoked = false,
                revokedAt = null,
                expiresAt =
                    now
                        .plusSeconds(config.refreshTokenFamilyTtlDays * SECONDS_PER_DAY)
                        .let { kotlinx.datetime.Instant.fromEpochMilliseconds(it.toEpochMilli()) },
                createdAt = kotlinx.datetime.Instant.fromEpochMilliseconds(now.toEpochMilli()),
                updatedAt = kotlinx.datetime.Instant.fromEpochMilliseconds(now.toEpochMilli()),
            )
        refreshTokenFamilyStore.save(family)

        return TokenPair(
            accessToken = buildAccessToken(playerId, now),
            refreshToken = "$familyToken:$rawRefreshToken",
            familyToken = familyToken,
        )
    }

    /**
     * Verifies the access token signature and expiry.
     *
     * @param token The raw JWT string from the Authorization header.
     * @return The [PlayerId] embedded in the token, or null if invalid/expired.
     */
    @Suppress("ReturnCount", "TooGenericExceptionCaught")
    public fun verifyAccessToken(token: String): PlayerId? {
        return try {
            val jwt = SignedJWT.parse(token)
            if (!jwt.verify(verifier)) {
                return null
            }
            val claims = jwt.jwtClaimsSet
            if (claims.expirationTime?.before(Date()) == true) {
                return null
            }
            if (claims.issuer != config.issuer) {
                return null
            }
            val subject = claims.subject ?: return null
            PlayerId(UUID.fromString(subject))
        } catch (e: Exception) {
            log.debug("Access token verification failed: {}", e.message)
            null
        }
    }

    /**
     * Rotates a refresh token within its family.
     *
     * If the presented token does not match the current hash (replay attack), the
     * entire family is revoked and a [TokenReplayException] is thrown.
     *
     * @param presentedToken The raw `familyToken:rawRefreshToken` string from the client.
     * @return A new [TokenPair] with a new access token and rotated refresh token.
     */
    @Suppress("ThrowsCount")
    public suspend fun rotateRefreshToken(presentedToken: String): TokenPair {
        val parts = presentedToken.split(":", limit = 2)
        require(parts.size == 2) { "Malformed refresh token" }
        val (familyToken, rawToken) = parts

        val family =
            refreshTokenFamilyStore.findByFamilyToken(familyToken)
                ?: throw TokenException("Refresh token family not found")

        if (family.isRevoked) {
            throw TokenException("Refresh token family has been revoked")
        }

        if (kotlinx.datetime.Clock.System
                .now() > family.expiresAt
        ) {
            throw TokenException("Refresh token family expired")
        }

        val presentedHash = sha256Hex(rawToken)
        if (presentedHash != family.currentTokenHash) {
            // Replay attack: revoke the entire family
            log.warn("Token replay detected for family {}; revoking", familyToken)
            refreshTokenFamilyStore.revokeFamily(familyToken)
            throw TokenReplayException("Refresh token replay detected; all sessions revoked")
        }

        val playerId = family.playerId ?: throw TokenException("Family has no associated player")

        // Issue new tokens and rotate
        val newRawToken = UUID.randomUUID().toString()
        val newHash = sha256Hex(newRawToken)
        val now =
            kotlinx.datetime.Clock.System
                .now()

        refreshTokenFamilyStore.save(
            family.copy(
                currentTokenHash = newHash,
                updatedAt = now,
            ),
        )

        return TokenPair(
            accessToken = buildAccessToken(playerId, Instant.now()),
            refreshToken = "$familyToken:$newRawToken",
            familyToken = familyToken,
        )
    }

    /**
     * Revokes an entire refresh token family (logout).
     */
    public suspend fun revokeFamily(familyToken: String) {
        refreshTokenFamilyStore.revokeFamily(familyToken)
    }

    private fun buildAccessToken(
        playerId: PlayerId,
        now: Instant,
    ): String {
        val expiry = now.plusSeconds(config.accessTokenTtlSeconds)
        val claims =
            JWTClaimsSet
                .Builder()
                .subject(playerId.value.toString())
                .issuer(config.issuer)
                .issueTime(Date.from(now))
                .expirationTime(Date.from(expiry))
                .jwtID(UUID.randomUUID().toString())
                .build()
        val jwt = SignedJWT(JWSHeader(JWSAlgorithm.HS256), claims)
        jwt.sign(signer)
        return jwt.serialize()
    }

    private fun sha256Hex(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest
            .digest(input.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }

    private companion object {
        const val SECONDS_PER_DAY = 86_400L
        const val MINUTES_PER_HOUR = 60L
        const val ACCESS_TOKEN_TTL_MINUTES = 15L
        const val DEFAULT_ACCESS_TOKEN_TTL_SECONDS = ACCESS_TOKEN_TTL_MINUTES * MINUTES_PER_HOUR
        const val DEFAULT_REFRESH_TOKEN_FAMILY_TTL_DAYS = 30L
    }
}

/** Thrown when a refresh token replay attack is detected. */
public class TokenReplayException(
    message: String,
) : Exception(message)

/** General token exception (expired, invalid, revoked). */
public class TokenException(
    message: String,
) : Exception(message)
