package com.prizedraw.contracts.dto.notification

import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class PushPayloadDto(
    val title: String,
    val body: String,
    val data: Map<String, String>,
)

@Serializable
public data class NotificationDto(
    val id: String,
    val type: String,
    val title: String,
    val body: String,
    val isRead: Boolean,
    val createdAt: Instant,
)
