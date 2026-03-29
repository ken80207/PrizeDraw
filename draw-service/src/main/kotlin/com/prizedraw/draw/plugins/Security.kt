@file:Suppress("MatchingDeclarationName", "BracesOnIfStatements")

package com.prizedraw.draw.plugins

import com.prizedraw.draw.domain.valueobjects.PlayerId
import com.prizedraw.shared.auth.JwtVerifier
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.bearer
import org.koin.ktor.ext.inject
import java.util.UUID

/**
 * Wraps a verified [PlayerId] as an authenticated Ktor principal for draw-service routes.
 */
public data class PlayerPrincipal(
    val playerId: PlayerId,
) : io.ktor.server.auth.Principal

/**
 * Installs Ktor Bearer authentication using the shared [JwtVerifier].
 *
 * - `authenticate("player")` — verifies player JWTs locally via [JwtVerifier] from the
 *   `:shared` module. No HTTP call to Core API is made. The `sub` claim is parsed as a
 *   [UUID] and wrapped in a [PlayerPrincipal].
 */
public fun Application.configureSecurity() {
    val jwtVerifier: JwtVerifier by inject()
    val devBypassAuth = System.getenv("DEV_BYPASS_AUTH")?.toBooleanStrictOrNull() ?: false

    install(Authentication) {
        bearer("player") {
            authenticate { credential ->
                if (devBypassAuth) {
                    val demoId = UUID.fromString("00000000-0000-0000-0000-000000000001")
                    return@authenticate PlayerPrincipal(PlayerId(demoId))
                }
                val claims = jwtVerifier.verifyPlayerToken(credential.token)
                if (claims != null) PlayerPrincipal(PlayerId(claims.playerId)) else null
            }
            if (devBypassAuth) {
                skipWhen { true }
            }
        }
    }
}
