package com.prizedraw.contracts.dto.auth

import com.prizedraw.contracts.enums.OAuthProvider
import kotlinx.serialization.Serializable

@Serializable
public data class LoginRequest(
    val provider: OAuthProvider,
    val idToken: String,
)

@Serializable
public data class TokenResponse(
    val accessToken: String,
    val refreshToken: String,
    val expiresIn: Long,
)

@Serializable
public data class RefreshRequest(
    val refreshToken: String,
)

@Serializable
public data class PhoneBindRequest(
    val phoneNumber: String,
    val otpCode: String,
)

@Serializable
public data class SendOtpRequest(
    val phoneNumber: String,
)

@Serializable
public data class LogoutRequest(
    val refreshToken: String,
)
