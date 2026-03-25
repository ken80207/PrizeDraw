package com.prizedraw.api.routes

import com.prizedraw.api.plugins.PlayerPrincipal
import com.prizedraw.application.ports.input.auth.IBindPhoneUseCase
import com.prizedraw.application.ports.input.auth.ILoginUseCase
import com.prizedraw.application.ports.input.auth.ILogoutUseCase
import com.prizedraw.application.ports.input.auth.IRefreshTokenUseCase
import com.prizedraw.application.ports.input.auth.ISendOtpUseCase
import com.prizedraw.application.usecases.auth.AuthException
import com.prizedraw.application.usecases.auth.OtpInvalidException
import com.prizedraw.application.usecases.auth.OtpRateLimitException
import com.prizedraw.application.usecases.auth.PhoneAlreadyBoundException
import com.prizedraw.contracts.dto.auth.LoginRequest
import com.prizedraw.contracts.dto.auth.LogoutRequest
import com.prizedraw.contracts.dto.auth.PhoneBindRequest
import com.prizedraw.contracts.dto.auth.RefreshRequest
import com.prizedraw.contracts.dto.auth.SendOtpRequest
import com.prizedraw.contracts.endpoints.AuthEndpoints
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.auth.authenticate
import io.ktor.server.auth.principal
import io.ktor.server.request.receive
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.post
import org.koin.ktor.ext.inject

/**
 * Registers all authentication API routes.
 *
 * Public endpoints (no JWT required):
 * - POST [AuthEndpoints.LOGIN] — OAuth social login
 * - POST [AuthEndpoints.REFRESH] — refresh token rotation
 * - POST [AuthEndpoints.SEND_OTP] — send OTP to phone
 *
 * Protected endpoints (JWT required via `authenticate("player")`):
 * - POST [AuthEndpoints.LOGOUT] — revoke refresh token family
 * - POST [AuthEndpoints.VERIFY_PHONE] — bind phone number after OTP verification
 */
public fun Route.authRoutes() {
    post(AuthEndpoints.LOGIN) {
        val loginUseCase: ILoginUseCase by call.application.inject()
        val request = call.receive<LoginRequest>()
        val response = loginUseCase.execute(request)
        call.respond(HttpStatusCode.OK, response)
    }

    post(AuthEndpoints.REFRESH) {
        val refreshTokenUseCase: IRefreshTokenUseCase by call.application.inject()
        val request = call.receive<RefreshRequest>()
        try {
            val response = refreshTokenUseCase.execute(request)
            call.respond(HttpStatusCode.OK, response)
        } catch (e: AuthException) {
            call.respond(HttpStatusCode.Unauthorized, mapOf("error" to e.message))
        }
    }

    post(AuthEndpoints.SEND_OTP) {
        val sendOtpUseCase: ISendOtpUseCase by call.application.inject()
        val request = call.receive<SendOtpRequest>()
        try {
            sendOtpUseCase.execute(request)
            call.respond(HttpStatusCode.NoContent)
        } catch (e: OtpRateLimitException) {
            call.respond(HttpStatusCode.TooManyRequests, mapOf("error" to e.message))
        }
    }

    authenticate("player") {
        post(AuthEndpoints.LOGOUT) {
            val logoutUseCase: ILogoutUseCase by call.application.inject()
            val request = call.receive<LogoutRequest>()
            logoutUseCase.execute(request)
            call.respond(HttpStatusCode.NoContent)
        }

        post(AuthEndpoints.VERIFY_PHONE) {
            val bindPhoneUseCase: IBindPhoneUseCase by call.application.inject()
            val principal = call.principal<PlayerPrincipal>()!!
            val request = call.receive<PhoneBindRequest>()
            try {
                val playerDto = bindPhoneUseCase.execute(principal.playerId, request)
                call.respond(HttpStatusCode.OK, playerDto)
            } catch (e: OtpInvalidException) {
                call.respond(HttpStatusCode.UnprocessableEntity, mapOf("error" to e.message))
            } catch (e: PhoneAlreadyBoundException) {
                call.respond(HttpStatusCode.Conflict, mapOf("error" to e.message))
            }
        }
    }
}
