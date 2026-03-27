@file:Suppress("MatchingDeclarationName")

package com.prizedraw.api.plugins

import com.prizedraw.application.ports.output.IStaffRepository
import com.prizedraw.application.services.StaffTokenService
import com.prizedraw.application.services.TokenService
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.StaffId
import java.util.UUID
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.authentication
import io.ktor.server.auth.bearer
import io.ktor.server.auth.principal
import org.koin.ktor.ext.inject

/**
 * Wraps a verified [PlayerId] as an authenticated Ktor principal.
 */
public data class PlayerPrincipal(
    val playerId: PlayerId,
) : io.ktor.server.auth.Principal

/**
 * Installs Ktor Bearer authentication for both player and staff schemes.
 *
 * - `authenticate("player")` — verifies player JWTs via [TokenService].
 * - `authenticate("staff")` — verifies staff JWTs via [StaffTokenService]; produces [StaffPrincipal].
 *
 * Routes that require player authentication use `authenticate("player") { ... }`.
 * Admin routes use `authenticate("staff") { ... }` combined with [withMinimumRole].
 */
public fun Application.configureSecurity() {
    val tokenService: TokenService by inject()
    val staffTokenService: StaffTokenService by inject()
    val staffRepository: IStaffRepository by inject()

    @Suppress("ForbiddenComment") // Tracked in backlog — auth bypass is dev-only
    // TODO: Re-enable real auth verification before production
    val devBypassAuth = System.getenv("DEV_BYPASS_AUTH")?.toBooleanStrictOrNull() ?: false

    install(Authentication) {
        bearer("player") {
            authenticate { credential ->
                if (devBypassAuth) {
                    val demoId = UUID.fromString("00000000-0000-0000-0000-000000000001")
                    return@authenticate PlayerPrincipal(PlayerId(demoId))
                }
                val playerId = tokenService.verifyAccessToken(credential.token)
                if (playerId != null) {
                    PlayerPrincipal(playerId)
                } else {
                    null
                }
            }
            if (devBypassAuth) {
                skipWhen { true }
            }
        }

        bearer("staff") {
            authenticate { credential ->
                if (devBypassAuth) {
                    return@authenticate StaffPrincipal(
                        staffId = StaffId(UUID.fromString("00000000-0000-0000-0000-000000000002")),
                        role = com.prizedraw.contracts.enums.StaffRole.OWNER,
                    )
                }
                val claims =
                    staffTokenService.verifyAccessToken(credential.token)
                        ?: return@authenticate null
                val staff =
                    staffRepository.findById(StaffId(claims.staffId))
                        ?: return@authenticate null
                if (!staff.isActive) {
                    return@authenticate null
                }
                StaffPrincipal(staffId = StaffId(claims.staffId), role = staff.role)
            }
            if (devBypassAuth) {
                skipWhen { true }
            }
        }
    }

    // In dev bypass mode, install a plugin that provides a fake principal
    // for routes that skip auth (since skipWhen bypasses the authenticate callback)
    if (devBypassAuth) {
        val devAuthPlugin = io.ktor.server.application.createApplicationPlugin("DevAuthBypass") {
            onCall { call ->
                @Suppress("DEPRECATION")
                if (call.principal<PlayerPrincipal>() == null) {
                    call.authentication.principal(
                        PlayerPrincipal(PlayerId(UUID.fromString("00000000-0000-0000-0000-000000000001"))),
                    )
                }
                @Suppress("DEPRECATION")
                if (call.principal<StaffPrincipal>() == null) {
                    call.authentication.principal(
                        StaffPrincipal(
                            staffId = StaffId(UUID.fromString("00000000-0000-0000-0000-000000000002")),
                            role = com.prizedraw.contracts.enums.StaffRole.OWNER,
                        ),
                    )
                }
            }
        }
        install(devAuthPlugin)
    }
}
