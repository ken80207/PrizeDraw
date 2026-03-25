@file:Suppress("MatchingDeclarationName")

package com.prizedraw.api.plugins

import com.prizedraw.application.services.TokenException
import com.prizedraw.application.services.TokenReplayException
import com.prizedraw.application.usecases.auth.AuthException
import com.prizedraw.application.usecases.auth.OtpInvalidException
import com.prizedraw.application.usecases.auth.OtpRateLimitException
import com.prizedraw.application.usecases.auth.PhoneAlreadyBoundException
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.Application
import io.ktor.server.application.install
import io.ktor.server.plugins.requestvalidation.RequestValidationException
import io.ktor.server.plugins.statuspages.StatusPages
import io.ktor.server.response.respond
import kotlinx.serialization.Serializable

/**
 * Standardized error response body returned by all error handlers.
 */
@Serializable
public data class ErrorResponse(
    val code: String,
    val message: String,
    val details: List<String> = emptyList(),
)

/**
 * Installs [StatusPages] mapping domain exceptions to HTTP status codes.
 *
 * All unhandled exceptions produce a 500 response; known domain exceptions are mapped
 * to appropriate 4xx codes.
 */
@Suppress("LongMethod")
public fun Application.configureStatusPages() {
    install(StatusPages) {
        exception<RequestValidationException> { call, cause ->
            call.respond(
                HttpStatusCode.UnprocessableEntity,
                ErrorResponse(
                    code = "VALIDATION_ERROR",
                    message = "Request validation failed",
                    details = cause.reasons,
                ),
            )
        }

        exception<AuthException> { call, cause ->
            call.respond(
                HttpStatusCode.Unauthorized,
                ErrorResponse(
                    code = "AUTH_FAILED",
                    message = cause.message ?: "Authentication failed",
                ),
            )
        }

        exception<OtpInvalidException> { call, cause ->
            call.respond(
                HttpStatusCode.UnprocessableEntity,
                ErrorResponse(
                    code = "OTP_INVALID",
                    message = cause.message ?: "OTP verification failed",
                ),
            )
        }

        exception<OtpRateLimitException> { call, cause ->
            call.respond(
                HttpStatusCode.TooManyRequests,
                ErrorResponse(
                    code = "OTP_RATE_LIMIT",
                    message = cause.message ?: "Too many OTP requests",
                ),
            )
        }

        exception<PhoneAlreadyBoundException> { call, cause ->
            call.respond(
                HttpStatusCode.Conflict,
                ErrorResponse(
                    code = "PHONE_ALREADY_BOUND",
                    message = cause.message ?: "Phone number already bound",
                ),
            )
        }

        exception<TokenReplayException> { call, _ ->
            call.respond(
                HttpStatusCode.Unauthorized,
                ErrorResponse(
                    code = "TOKEN_REPLAY",
                    message = "Token replay detected; all sessions revoked",
                ),
            )
        }

        exception<TokenException> { call, cause ->
            call.respond(
                HttpStatusCode.Unauthorized,
                ErrorResponse(
                    code = "INVALID_TOKEN",
                    message = cause.message ?: "Invalid or expired token",
                ),
            )
        }

        exception<IllegalArgumentException> { call, cause ->
            call.respond(
                HttpStatusCode.BadRequest,
                ErrorResponse(
                    code = "BAD_REQUEST",
                    message = cause.message ?: "Bad request",
                ),
            )
        }

        exception<NoSuchElementException> { call, _ ->
            call.respond(
                HttpStatusCode.NotFound,
                ErrorResponse(
                    code = "NOT_FOUND",
                    message = "The requested resource was not found",
                ),
            )
        }

        exception<Throwable> { call, cause ->
            call.application.environment.log
                .error("Unhandled exception", cause)
            call.respond(
                HttpStatusCode.InternalServerError,
                ErrorResponse(
                    code = "INTERNAL_ERROR",
                    message = "An unexpected error occurred",
                ),
            )
        }

        status(HttpStatusCode.NotFound) { call, _ ->
            call.respond(
                HttpStatusCode.NotFound,
                ErrorResponse(code = "NOT_FOUND", message = "Route not found"),
            )
        }

        status(HttpStatusCode.Unauthorized) { call, _ ->
            call.respond(
                HttpStatusCode.Unauthorized,
                ErrorResponse(code = "UNAUTHORIZED", message = "Authentication required"),
            )
        }

        status(HttpStatusCode.Forbidden) { call, _ ->
            call.respond(
                HttpStatusCode.Forbidden,
                ErrorResponse(code = "FORBIDDEN", message = "Access denied"),
            )
        }
    }
}
