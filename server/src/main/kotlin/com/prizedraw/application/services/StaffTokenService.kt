package com.prizedraw.application.services

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.MACSigner
import com.nimbusds.jose.crypto.MACVerifier
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.valueobjects.StaffId
import org.slf4j.LoggerFactory
import java.time.Instant
import java.util.Date
import java.util.UUID

/**
 * Claims extracted from a verified staff access token.
 *
 * @property staffId The staff member's UUID.
 * @property role The staff member's role at time of issue.
 */
public data class StaffTokenClaims(
    val staffId: UUID,
    val role: StaffRole,
)

/**
 * JWT-based access token service for staff authentication.
 *
 * Staff tokens carry both the staff UUID and their [StaffRole] as a custom claim.
 * Access tokens are short-lived (15 minutes by default), signed with HS256.
 *
 * @property jwtSecret HS256 secret key (minimum 256 bits / 32 bytes).
 * @property issuer JWT issuer claim value.
 * @property accessTokenTtlSeconds Access token validity in seconds.
 */
public class StaffTokenService(
    private val jwtSecret: String,
    private val issuer: String = "prizedraw",
    private val accessTokenTtlSeconds: Long = DEFAULT_TTL_SECONDS,
) {
    private val log = LoggerFactory.getLogger(StaffTokenService::class.java)
    private val signer = MACSigner(jwtSecret.toByteArray(Charsets.UTF_8))
    private val verifier = MACVerifier(jwtSecret.toByteArray(Charsets.UTF_8))

    /**
     * Issues a signed access token for the given [staffId] and [role].
     *
     * @param staffId The staff member's unique identifier.
     * @param role The staff member's current role.
     * @return Serialized JWT string.
     */
    public fun createAccessToken(
        staffId: StaffId,
        role: StaffRole,
    ): String {
        val now = Instant.now()
        val expiry = now.plusSeconds(accessTokenTtlSeconds)
        val claims =
            JWTClaimsSet
                .Builder()
                .subject(staffId.value.toString())
                .issuer(issuer)
                .claim(CLAIM_ROLE, role.name)
                .claim(CLAIM_ACTOR, "STAFF")
                .issueTime(Date.from(now))
                .expirationTime(Date.from(expiry))
                .jwtID(UUID.randomUUID().toString())
                .build()
        val jwt = SignedJWT(JWSHeader(JWSAlgorithm.HS256), claims)
        jwt.sign(signer)
        return jwt.serialize()
    }

    /**
     * Verifies a staff access token and returns its claims.
     *
     * @param token The raw JWT string from the Authorization header.
     * @return [StaffTokenClaims] if the token is valid, null otherwise.
     */
    @Suppress("ReturnCount", "TooGenericExceptionCaught")
    public fun verifyAccessToken(token: String): StaffTokenClaims? {
        return try {
            val jwt = SignedJWT.parse(token)
            if (!jwt.verify(verifier)) {
                return null
            }
            val claims = jwt.jwtClaimsSet
            if (claims.expirationTime?.before(Date()) == true) {
                return null
            }
            if (claims.issuer != issuer) {
                return null
            }
            if (claims.getStringClaim(CLAIM_ACTOR) != "STAFF") {
                return null
            }
            val staffId = UUID.fromString(claims.subject ?: return null)
            val role = StaffRole.valueOf(claims.getStringClaim(CLAIM_ROLE) ?: return null)
            StaffTokenClaims(staffId = staffId, role = role)
        } catch (e: Exception) {
            log.debug("Staff token verification failed: {}", e.message)
            null
        }
    }

    private companion object {
        const val CLAIM_ROLE = "role"
        const val CLAIM_ACTOR = "actor"
        const val DEFAULT_TTL_SECONDS = 900L
    }
}
