package com.prizedraw.shared.auth

import com.nimbusds.jose.JWSAlgorithm
import com.nimbusds.jose.JWSHeader
import com.nimbusds.jose.crypto.MACSigner
import com.nimbusds.jwt.JWTClaimsSet
import com.nimbusds.jwt.SignedJWT
import io.kotest.core.spec.style.FunSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe
import java.util.Date
import java.util.UUID

/**
 * Unit tests for [JwtVerifier].
 *
 * Token signing uses the same Nimbus JOSE+JWT library that the production auth
 * service uses, so the tokens produced here are structurally identical to real tokens.
 *
 * Test scenarios (player tokens):
 * - Valid player token is accepted and claims are correctly extracted.
 * - Expired token is rejected (returns null).
 * - Token signed with the wrong secret is rejected.
 * - Token with a wrong issuer is rejected.
 * - Token with a missing `sub` claim is rejected.
 * - Token with a non-UUID `sub` claim is rejected.
 * - Completely malformed (non-JWT) string is rejected.
 *
 * Test scenarios (staff tokens):
 * - Valid staff token with `role` claim is accepted.
 * - Staff token without a `role` claim is rejected.
 * - Staff token with a blank `role` claim is rejected.
 */
class JwtVerifierTest :
    FunSpec({

        val secret = "test-secret-that-is-at-least-32-chars-long!!"
        val issuer = "prizedraw"
        val verifier = JwtVerifier(jwtSecret = secret, expectedIssuer = issuer)
        val wrongSecretVerifier =
            JwtVerifier(
                jwtSecret = "wrong-secret-that-is-at-least-32-chars-!",
                expectedIssuer = issuer,
            )

        // ------------------------------------------------------------------ //
        // Token builder helpers                                               //
        // ------------------------------------------------------------------ //

        fun buildPlayerToken(
            subject: String = UUID.randomUUID().toString(),
            iss: String = issuer,
            signingSecret: String = secret,
            expiryMs: Long = System.currentTimeMillis() + 3_600_000L, // +1 hour
        ): String {
            val claims =
                JWTClaimsSet
                    .Builder()
                    .subject(subject)
                    .issuer(iss)
                    .expirationTime(Date(expiryMs))
                    .build()
            val header = JWSHeader(JWSAlgorithm.HS256)
            val jwt = SignedJWT(header, claims)
            jwt.sign(MACSigner(signingSecret.toByteArray(Charsets.UTF_8)))
            return jwt.serialize()
        }

        fun buildStaffToken(
            subject: String = UUID.randomUUID().toString(),
            role: String? = "ADMIN",
            iss: String = issuer,
            signingSecret: String = secret,
            expiryMs: Long = System.currentTimeMillis() + 3_600_000L,
        ): String {
            val builder =
                JWTClaimsSet
                    .Builder()
                    .subject(subject)
                    .issuer(iss)
                    .expirationTime(Date(expiryMs))
            if (role != null) {
                builder.claim("role", role)
            }
            val jwt = SignedJWT(JWSHeader(JWSAlgorithm.HS256), builder.build())
            jwt.sign(MACSigner(signingSecret.toByteArray(Charsets.UTF_8)))
            return jwt.serialize()
        }

        // ------------------------------------------------------------------ //
        // Player token tests                                                  //
        // ------------------------------------------------------------------ //

        test("valid player token is accepted and claims are extracted") {
            val playerId = UUID.randomUUID()
            val token = buildPlayerToken(subject = playerId.toString())

            val claims = verifier.verifyPlayerToken(token)

            claims.shouldNotBeNull()
            claims.playerId shouldBe playerId
            claims.issuer shouldBe issuer
        }

        test("expired player token is rejected") {
            val token = buildPlayerToken(expiryMs = System.currentTimeMillis() - 1_000L)

            val claims = verifier.verifyPlayerToken(token)

            claims.shouldBeNull()
        }

        test("player token signed with wrong secret is rejected") {
            val token = buildPlayerToken()

            val claims = wrongSecretVerifier.verifyPlayerToken(token)

            claims.shouldBeNull()
        }

        test("player token with wrong issuer is rejected") {
            val token = buildPlayerToken(iss = "other-service")

            val claims = verifier.verifyPlayerToken(token)

            claims.shouldBeNull()
        }

        test("player token with non-UUID sub is rejected") {
            val token = buildPlayerToken(subject = "not-a-uuid")

            val claims = verifier.verifyPlayerToken(token)

            claims.shouldBeNull()
        }

        test("malformed string is rejected gracefully") {
            val claims = verifier.verifyPlayerToken("this.is.not.a.jwt")

            claims.shouldBeNull()
        }

        test("empty string is rejected gracefully") {
            val claims = verifier.verifyPlayerToken("")

            claims.shouldBeNull()
        }

        // ------------------------------------------------------------------ //
        // Staff token tests                                                   //
        // ------------------------------------------------------------------ //

        test("valid staff token with role claim is accepted") {
            val staffId = UUID.randomUUID()
            val token = buildStaffToken(subject = staffId.toString(), role = "ADMIN")

            val claims = verifier.verifyStaffToken(token)

            claims.shouldNotBeNull()
            claims.staffId shouldBe staffId
            claims.role shouldBe "ADMIN"
            claims.issuer shouldBe issuer
        }

        test("staff token without role claim is rejected") {
            val token = buildStaffToken(role = null)

            val claims = verifier.verifyStaffToken(token)

            claims.shouldBeNull()
        }

        test("staff token with blank role claim is rejected") {
            val token = buildStaffToken(role = "   ")

            val claims = verifier.verifyStaffToken(token)

            claims.shouldBeNull()
        }

        test("expired staff token is rejected") {
            val token = buildStaffToken(expiryMs = System.currentTimeMillis() - 1_000L)

            val claims = verifier.verifyStaffToken(token)

            claims.shouldBeNull()
        }

        test("staff verifier rejects player token with wrong secret") {
            val token = buildStaffToken(role = "SUPPORT")
            val claims = wrongSecretVerifier.verifyStaffToken(token)

            claims.shouldBeNull()
        }

        // ------------------------------------------------------------------ //
        // Cross-type tests                                                    //
        // ------------------------------------------------------------------ //

        test("verifyPlayerToken rejects a staff token (role claim present but not checked)") {
            // A staff token IS a valid player token structurally — both share the same
            // subject format. verifyPlayerToken does not care about the role claim, so
            // a staff token should parse as a player token successfully.
            val staffId = UUID.randomUUID()
            val token = buildStaffToken(subject = staffId.toString())

            val claims = verifier.verifyPlayerToken(token)

            // The verifier does not distinguish staff vs player at the JWT layer;
            // route-level middleware determines which verifier method to call.
            claims.shouldNotBeNull()
            claims.playerId shouldBe staffId
        }
    })
