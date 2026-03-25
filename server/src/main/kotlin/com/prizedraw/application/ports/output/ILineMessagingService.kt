package com.prizedraw.application.ports.output

/**
 * Output port for sending messages via the LINE Messaging API.
 *
 * Implementations wrap the LINE Bot SDK or direct HTTP calls to the LINE Messaging API.
 * All methods are suspend to allow non-blocking I/O.
 */
public interface ILineMessagingService {
    /**
     * Sends a reply message to a LINE user using a LINE reply token.
     *
     * Reply tokens are single-use and expire approximately 30 seconds after the
     * webhook event is delivered.
     *
     * @param replyToken The one-time reply token from the incoming webhook event.
     * @param text The plain-text message body to send.
     */
    public suspend fun replyMessage(
        replyToken: String,
        text: String,
    )

    /**
     * Pushes a message to a LINE user by their LINE user ID (not reply-token based).
     *
     * Push messages can be sent at any time after the initial interaction and are
     * subject to LINE's messaging quota limits.
     *
     * @param lineUserId The LINE user ID of the recipient.
     * @param text The plain-text message body to send.
     */
    public suspend fun pushMessage(
        lineUserId: String,
        text: String,
    )
}
