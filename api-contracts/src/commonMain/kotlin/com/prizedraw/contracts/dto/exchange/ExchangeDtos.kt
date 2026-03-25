package com.prizedraw.contracts.dto.exchange

import com.prizedraw.contracts.enums.ExchangeRequestStatus
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class ExchangeOfferDto(
    val id: String,
    val initiatorId: String,
    val initiatorNickname: String,
    val recipientId: String,
    val recipientNickname: String,
    val initiatorItems: List<ExchangeItemDto>,
    val recipientItems: List<ExchangeItemDto>,
    val status: ExchangeRequestStatus,
    val message: String?,
    val createdAt: Instant,
)

@Serializable
public data class ExchangeItemDto(
    val prizeInstanceId: String,
    val grade: String,
    val prizeName: String,
    val prizePhotoUrl: String,
)

@Serializable
public data class CreateExchangeRequest(
    val recipientId: String,
    val offeredPrizeInstanceIds: List<String>,
    val requestedPrizeInstanceIds: List<String>,
    val message: String? = null,
)

@Serializable
public enum class ExchangeResponseAction {
    ACCEPT,
    REJECT,
    COUNTER_PROPOSE,
}

@Serializable
public data class RespondExchangeRequest(
    val action: ExchangeResponseAction,
    val counterOfferedPrizeInstanceIds: List<String>? = null,
)
