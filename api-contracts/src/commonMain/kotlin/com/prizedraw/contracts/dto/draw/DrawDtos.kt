package com.prizedraw.contracts.dto.draw

import com.prizedraw.contracts.enums.QueueEntryStatus
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class DrawTicketDto(
    val id: String,
    val position: Int,
    val status: String,
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
    val ticketIds: List<String> = emptyList(),
    val quantity: Int = 1,
    val mode: String = "RANDOM",
    val animationMode: String = "SCRATCH",
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
    val pityProgress: com.prizedraw.contracts.dto.pity.PityProgressDto? = null,
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

/**
 * A single entry in the draw history (中獎紀錄) for a campaign.
 *
 * Returned by both the admin and public draw-records endpoints.
 * [prizePhotoUrl] is the first photo URL from the prize definition's photo array,
 * or null when no photo has been configured for the prize.
 */
@Serializable
public data class DrawRecordDto(
    val ticketId: String,
    val position: Int,
    val grade: String,
    val prizeName: String,
    val prizePhotoUrl: String?,
    val playerNickname: String,
    val drawnAt: Instant,
)
