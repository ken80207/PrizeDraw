package com.prizedraw.contracts.endpoints

public object AuthEndpoints {
    public const val LOGIN: String = "/api/v1/auth/login"
    public const val REFRESH: String = "/api/v1/auth/refresh"
    public const val LOGOUT: String = "/api/v1/auth/logout"
    public const val SEND_OTP: String = "/api/v1/auth/otp/send"
    public const val VERIFY_PHONE: String = "/api/v1/auth/phone/bind"
}
