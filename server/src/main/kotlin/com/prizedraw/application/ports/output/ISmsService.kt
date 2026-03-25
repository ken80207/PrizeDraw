package com.prizedraw.application.ports.output

/**
 * Output port for dispatching SMS messages.
 *
 * The primary use case is OTP delivery during phone number binding.
 * Implementations are provider-specific (Twilio, AWS SNS, etc.).
 */
public interface ISmsService {
    /**
     * Sends an SMS message to the specified E.164 phone number.
     *
     * @param phoneNumber Target phone number in E.164 format (e.g. `+886912345678`).
     * @param message The text content of the SMS message.
     */
    public suspend fun send(
        phoneNumber: String,
        message: String,
    )
}
