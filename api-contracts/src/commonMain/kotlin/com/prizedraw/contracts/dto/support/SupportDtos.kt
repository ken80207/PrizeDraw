package com.prizedraw.contracts.dto.support

import com.prizedraw.contracts.enums.SupportTicketCategory
import com.prizedraw.contracts.enums.SupportTicketStatus
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class SupportTicketDto(
    val id: String,
    val category: SupportTicketCategory,
    val subject: String,
    val status: SupportTicketStatus,
    val messages: List<TicketMessageDto>,
    val satisfactionScore: Int?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

@Serializable
public data class TicketMessageDto(
    val id: String,
    val senderType: String,
    val senderId: String?,
    val body: String,
    val isRead: Boolean,
    val createdAt: Instant,
)

@Serializable
public data class CreateTicketRequest(
    val category: SupportTicketCategory,
    val subject: String,
    val body: String,
)

@Serializable
public data class ReplyTicketRequest(
    val ticketId: String,
    val body: String,
)

@Serializable
public data class CloseTicketRequest(
    val ticketId: String,
    val satisfactionScore: Int? = null,
)
