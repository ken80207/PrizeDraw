package com.prizedraw.application.usecases.auth

import com.prizedraw.application.ports.input.auth.ISendOtpUseCase
import com.prizedraw.application.ports.output.ISmsService
import com.prizedraw.contracts.dto.auth.SendOtpRequest
import com.prizedraw.infrastructure.external.redis.RedisClient
import io.lettuce.core.SetArgs
import kotlinx.coroutines.future.await
import org.slf4j.LoggerFactory
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Generates and delivers a 6-digit phone OTP with Redis-backed rate limiting and storage.
 *
 * Rate limit: max 5 OTP sends per phone per hour using `SET NX EX`.
 * OTP storage: SHA-256 hash stored at key `otp:{phone}` with 5-minute TTL.
 * The raw OTP is logged (stub SMS) or sent via [ISmsService].
 */
public class SendOtpUseCase(
    private val redisClient: RedisClient,
    private val smsService: ISmsService,
) : ISendOtpUseCase {
    private val log = LoggerFactory.getLogger(SendOtpUseCase::class.java)
    private val secureRandom = SecureRandom()

    override suspend fun execute(request: SendOtpRequest) {
        val phone = request.phoneNumber
        enforceRateLimit(phone)

        val otp = generateOtp()
        val hash = sha256Hex(otp)

        storeOtpHash(phone, hash)

        smsService.send(phone, "【PrizeDraw】Your verification code is $otp. Valid for 5 minutes.")
        log.debug("OTP sent to {}", phone)
    }

    private suspend fun enforceRateLimit(phone: String) {
        val rateLimitKey = "otp:ratelimit:$phone"
        redisClient.withConnection { commands ->
            val count = commands.get(rateLimitKey).await()?.toLongOrNull() ?: 0L
            if (count >= MAX_OTP_PER_HOUR) {
                throw OtpRateLimitException("OTP rate limit exceeded for $phone — maximum $MAX_OTP_PER_HOUR per hour")
            }

            // Increment with SETEX on first call, INCR on subsequent calls
            if (count == 0L) {
                commands.set(rateLimitKey, "1", SetArgs().ex(RATE_LIMIT_WINDOW_SECONDS)).await()
            } else {
                commands.incr(rateLimitKey).await()
            }
        }
    }

    private suspend fun storeOtpHash(
        phone: String,
        hash: String,
    ) {
        val otpKey = "otp:$phone"
        redisClient.withConnection { commands ->
            commands.set(otpKey, hash, SetArgs().ex(OTP_TTL_SECONDS)).await()
        }
    }

    private fun generateOtp(): String {
        val code = secureRandom.nextInt(OTP_RANGE)
        return code.toString().padStart(OTP_DIGITS, '0')
    }

    private fun sha256Hex(input: String): String {
        val digest = MessageDigest.getInstance("SHA-256")
        return digest
            .digest(input.toByteArray(Charsets.UTF_8))
            .joinToString("") { "%02x".format(it) }
    }

    private companion object {
        const val OTP_DIGITS = 6
        const val OTP_RANGE = 1_000_000
        const val OTP_TTL_SECONDS = 300L
        const val RATE_LIMIT_WINDOW_SECONDS = 3_600L
        const val MAX_OTP_PER_HOUR = 5L
    }
}
