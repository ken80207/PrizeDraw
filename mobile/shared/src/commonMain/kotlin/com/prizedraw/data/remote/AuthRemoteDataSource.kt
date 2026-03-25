package com.prizedraw.data.remote

import com.prizedraw.contracts.dto.auth.LoginRequest
import com.prizedraw.contracts.dto.auth.LogoutRequest
import com.prizedraw.contracts.dto.auth.PhoneBindRequest
import com.prizedraw.contracts.dto.auth.RefreshRequest
import com.prizedraw.contracts.dto.auth.SendOtpRequest
import com.prizedraw.contracts.dto.auth.TokenResponse
import com.prizedraw.contracts.dto.player.PlayerDto
import com.prizedraw.contracts.endpoints.AuthEndpoints

/**
 * Remote data source for authentication operations.
 *
 * Wraps Ktor Client calls to the server [AuthEndpoints] API.
 * The [AuthTokenStore] is updated after successful login/refresh operations.
 *
 * TODO(T092): Replace stubs with actual Ktor Client implementation using
 *   `io.ktor.client.HttpClient` configured with `ContentNegotiation(Json)`.
 */
public class AuthRemoteDataSource {
    // TODO(T092): inject HttpClient

    /**
     * Calls [AuthEndpoints.LOGIN] with the OAuth provider and ID token.
     *
     * @param request Login request with provider and idToken.
     * @return [TokenResponse] containing the new token pair.
     */
    public suspend fun login(request: LoginRequest): TokenResponse {
        TODO("T092: implement Ktor Client POST to ${AuthEndpoints.LOGIN}")
    }

    /**
     * Calls [AuthEndpoints.REFRESH] to rotate the refresh token.
     *
     * @param request Refresh request with the current refresh token.
     * @return A new [TokenResponse].
     */
    public suspend fun refresh(request: RefreshRequest): TokenResponse {
        TODO("T092: implement Ktor Client POST to ${AuthEndpoints.REFRESH}")
    }

    /**
     * Calls [AuthEndpoints.LOGOUT] to revoke the refresh token family.
     *
     * @param request Logout request with the refresh token to revoke.
     */
    public suspend fun logout(request: LogoutRequest) {
        TODO("T092: implement Ktor Client POST to ${AuthEndpoints.LOGOUT}")
    }

    /**
     * Calls [AuthEndpoints.SEND_OTP] to dispatch a verification OTP to a phone number.
     *
     * @param request OTP send request with the target phone number.
     */
    public suspend fun sendOtp(request: SendOtpRequest) {
        TODO("T092: implement Ktor Client POST to ${AuthEndpoints.SEND_OTP}")
    }

    /**
     * Calls [AuthEndpoints.VERIFY_PHONE] to bind a verified phone to the authenticated player.
     *
     * @param request Phone bind request with phone number and OTP code.
     * @return The updated [PlayerDto] with phone bound and isActive=true.
     */
    public suspend fun bindPhone(request: PhoneBindRequest): PlayerDto {
        TODO("T092: implement Ktor Client POST to ${AuthEndpoints.VERIFY_PHONE}")
    }
}
