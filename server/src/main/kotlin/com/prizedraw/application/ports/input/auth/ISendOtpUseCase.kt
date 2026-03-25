package com.prizedraw.application.ports.input.auth

import com.prizedraw.contracts.dto.auth.SendOtpRequest

/**
 * Input port for sending a phone OTP for verification.
 *
 * Rate-limited to a maximum of 5 OTPs per phone number per hour.
 * The generated OTP is stored in Redis with a 5-minute TTL.
 */
public interface ISendOtpUseCase {
    /**
     * Generates and dispatches a 6-digit OTP to the given phone number.
     *
     * @param request Request carrying the target phone number in E.164 format.
     * @throws com.prizedraw.application.usecases.auth.OtpRateLimitException if the rate limit
     *   (5 OTPs per hour) has been exceeded for this phone number.
     */
    public suspend fun execute(request: SendOtpRequest)
}
