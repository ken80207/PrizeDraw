package com.prizedraw.infrastructure.external.line

import com.prizedraw.application.ports.output.ILineMessagingService
import org.slf4j.LoggerFactory

/**
 * Stub implementation of [ILineMessagingService] used in development and testing.
 *
 * Logs all outbound messages instead of calling the real LINE Messaging API.
 * Replace with a real implementation backed by the LINE Bot SDK before production deployment.
 */
public class StubLineMessagingService : ILineMessagingService {
    private val log = LoggerFactory.getLogger(StubLineMessagingService::class.java)

    override suspend fun replyMessage(
        replyToken: String,
        text: String,
    ) {
        log.info("[LINE-STUB] replyMessage token={} text={}", replyToken, text)
    }

    override suspend fun pushMessage(
        lineUserId: String,
        text: String,
    ) {
        log.info("[LINE-STUB] pushMessage userId={} text={}", lineUserId, text)
    }
}
