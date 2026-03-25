package com.prizedraw.application.usecases.auth

/** Thrown when an authentication operation fails (invalid token, expired session, etc.). */
public class AuthException(
    message: String,
    cause: Throwable? = null,
) : Exception(message, cause)

/** Thrown when OTP verification fails due to an incorrect or expired code. */
public class OtpInvalidException(
    message: String,
) : Exception(message)

/** Thrown when the OTP send rate limit for a phone number has been exceeded. */
public class OtpRateLimitException(
    message: String,
) : Exception(message)

/** Thrown when a phone number is already bound to a different player account. */
public class PhoneAlreadyBoundException(
    message: String,
) : Exception(message)

/** Thrown when a requested player cannot be found. */
public class PlayerNotFoundException(
    message: String,
) : Exception(message)
