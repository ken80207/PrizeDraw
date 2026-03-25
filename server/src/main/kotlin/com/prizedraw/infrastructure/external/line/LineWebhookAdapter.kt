package com.prizedraw.infrastructure.external.line

import com.prizedraw.application.ports.input.support.ICreateSupportTicketUseCase
import com.prizedraw.application.ports.input.support.IReplySupportTicketUseCase
import com.prizedraw.application.ports.output.ILineMessagingService
import com.prizedraw.application.ports.output.ISupportRepository
import com.prizedraw.contracts.enums.SupportTicketCategory
import com.prizedraw.contracts.enums.SupportTicketStatus
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.util.UUID

/** Minimal deserialisation model for a LINE webhook payload. */
@Serializable
public data class LineWebhookPayload(
    val destination: String,
    val events: List<LineWebhookEvent>,
)

/** A single event inside a LINE webhook delivery. */
@Serializable
public data class LineWebhookEvent(
    val type: String,
    val replyToken: String = "",
    val source: LineEventSource = LineEventSource(),
    val message: LineEventMessage? = null,
)

/** Identifies the sender of a LINE event. */
@Serializable
public data class LineEventSource(
    val type: String = "user",
    val userId: String = "",
    val groupId: String? = null,
)

/** A message object from a LINE event. */
@Serializable
public data class LineEventMessage(
    val id: String = "",
    val type: String = "text",
    val text: String? = null,
)

/**
 * Processes incoming LINE webhook events and maps them to support ticket actions.
 *
 * Bidirectional flow:
 * - Incoming LINE message → finds existing open ticket by [lineThreadId] or creates a new one.
 * - Staff reply in the platform → calling [notifyLineUser] pushes the reply back to LINE.
 */
public class LineWebhookAdapter(
    private val supportRepository: ISupportRepository,
    private val createTicketUseCase: ICreateSupportTicketUseCase,
    private val replyTicketUseCase: IReplySupportTicketUseCase,
    private val lineMessagingService: ILineMessagingService,
) {
    private val log = LoggerFactory.getLogger(LineWebhookAdapter::class.java)
    private val json = Json { ignoreUnknownKeys = true }

    /**
     * Handles a raw LINE webhook payload JSON string.
     *
     * Only `message` events with `text` sub-type are processed.
     * Other event types (follow, unfollow, postback, etc.) are silently ignored.
     *
     * @param rawBody The raw JSON body of the webhook POST request.
     */
    public suspend fun handleWebhook(rawBody: String) {
        val payload =
            runCatching { json.decodeFromString<LineWebhookPayload>(rawBody) }.getOrElse { e ->
                log.warn("Failed to parse LINE webhook payload: {}", e.message)
                return
            }
        for (event in payload.events) {
            if (event.type == "message") {
                processMessageEvent(event)
            }
        }
    }

    private suspend fun processMessageEvent(event: LineWebhookEvent) {
        val lineUserId = event.source.userId.takeIf { it.isNotBlank() } ?: return
        val text = event.message?.text?.takeIf { it.isNotBlank() } ?: return
        val lineMessageId = event.message?.id ?: return
        val existingTicket =
            supportRepository
                .findTicketsForQueue(
                    status = SupportTicketStatus.OPEN,
                    priority = null,
                    assignedToStaffId = null,
                    offset = 0,
                    limit = 1,
                ).firstOrNull { it.lineThreadId == lineUserId }
                ?: supportRepository
                    .findTicketsForQueue(
                        status = SupportTicketStatus.IN_PROGRESS,
                        priority = null,
                        assignedToStaffId = null,
                        offset = 0,
                        limit = 1,
                    ).firstOrNull { it.lineThreadId == lineUserId }
        if (existingTicket != null) {
            replyTicketUseCase.execute(
                ticketId = existingTicket.id,
                playerId = PlayerId(existingTicket.playerId.value),
                staffId = null,
                body = "[LINE] $text",
            )
            log.info("Appended LINE message {} to ticket {}", lineMessageId, existingTicket.id)
        } else {
            val dummyPlayerId = PlayerId(derivePlayerIdFromLineUser(lineUserId))
            val newTicket =
                createTicketUseCase.execute(
                    playerId = dummyPlayerId,
                    category = SupportTicketCategory.OTHER,
                    subject = "LINE message from $lineUserId",
                    body = "[LINE] $text",
                )
            supportRepository.saveTicket(newTicket.copy(lineThreadId = lineUserId))
            log.info("Created new ticket {} for LINE user {}", newTicket.id, lineUserId)
        }
    }

    /**
     * Pushes a staff reply back to the LINE user associated with the ticket's thread.
     *
     * Should be called after a staff member replies to a ticket that has a [lineThreadId].
     *
     * @param lineUserId The LINE user ID extracted from [com.prizedraw.domain.entities.SupportTicket.lineThreadId].
     * @param replyText The staff reply text to deliver.
     */
    public suspend fun notifyLineUser(
        lineUserId: String,
        replyText: String,
    ) {
        lineMessagingService.pushMessage(lineUserId, replyText)
    }

    /** Derives a deterministic placeholder UUID from a LINE user ID for ticket association. */
    private fun derivePlayerIdFromLineUser(lineUserId: String): UUID =
        UUID.nameUUIDFromBytes("line:$lineUserId".toByteArray())
}
