@file:Suppress("MatchingDeclarationName")

package com.prizedraw.api.plugins

import com.prizedraw.application.ports.output.IStaffRepository
import com.prizedraw.application.services.StaffTokenService
import com.prizedraw.application.services.TokenService
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.StaffId
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.auth.Authentication
import io.ktor.server.auth.bearer
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

    install(Authentication) {
        bearer("player") {
            authenticate { credential ->
                val playerId = tokenService.verifyAccessToken(credential.token)
                if (playerId != null) {
                    PlayerPrincipal(playerId)
                } else {
                    null
                }
            }
        }

        bearer("staff") {
            authenticate { credential ->
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
        }
    }
}
