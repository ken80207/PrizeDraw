package com.prizedraw.infrastructure.external.sms

import com.prizedraw.application.ports.output.ISmsService
import org.slf4j.LoggerFactory

/**
 * Stub implementation of [ISmsService] for local development and testing.
 *
 * Logs the OTP message to the console instead of dispatching a real SMS.
 * Replace with a provider-specific adapter (Twilio, AWS SNS, etc.) before production.
 */
public class StubSmsService : ISmsService {
    private val log = LoggerFactory.getLogger(StubSmsService::class.java)

    override suspend fun send(
        phoneNumber: String,
        message: String,
    ) {
        log.info("StubSmsService — would send SMS to {}: {}", phoneNumber, message)
    }
}
