package com.prizedraw.contracts.dto.draw

import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.contracts.enums.QueueEntryStatus
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class DrawTicketDto(
    val id: String,
    val position: Int,
    val status: PrizeState,
    val drawnByPlayerId: String?,
    val drawnByNickname: String?,
    val drawnAt: Instant?,
    val prizeDefinitionId: String,
    val grade: String?,
    val prizeName: String?,
    val prizePhotoUrl: String?,
)

@Serializable
public data class DrawKujiRequest(
    val ticketBoxId: String,
    val ticketIds: List<String>,
    val quantity: Int,
)

@Serializable
public data class DrawUnlimitedRequest(
    val campaignId: String,
    val quantity: Int,
    val playerCouponId: String? = null,
)

@Serializable
public data class DrawResultDto(
    val tickets: List<DrawnTicketResultDto>,
)

@Serializable
public data class DrawnTicketResultDto(
    val ticketId: String,
    val position: Int,
    val prizeInstanceId: String,
    val grade: String,
    val prizeName: String,
    val prizePhotoUrl: String,
    val pointsCharged: Int,
    val discountApplied: Int,
)

@Serializable
public data class UnlimitedDrawResultDto(
    val prizeInstanceId: String,
    val grade: String,
    val prizeName: String,
    val prizePhotoUrl: String,
    val pointsCharged: Int,
)

@Serializable
public data class JoinQueueRequest(
    val ticketBoxId: String,
)

@Serializable
public data class LeaveQueueRequest(
    val ticketBoxId: String,
)

@Serializable
public data class SwitchBoxRequest(
    val fromBoxId: String,
    val toBoxId: String,
)

@Serializable
public data class QueueEntryDto(
    val id: String,
    val queueId: String,
    val playerId: String,
    val position: Int,
    val status: QueueEntryStatus,
    val joinedAt: Instant,
    val activatedAt: Instant?,
    val completedAt: Instant?,
    val queueLength: Int,
    val sessionExpiresAt: Instant?,
)
