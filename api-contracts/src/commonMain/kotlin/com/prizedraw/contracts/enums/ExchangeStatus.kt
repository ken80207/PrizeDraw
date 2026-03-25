package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

@Serializable
public enum class ExchangeRequestStatus {
    PENDING,
    COUNTER_PROPOSED,
    ACCEPTED,
    COMPLETED,
    REJECTED,
    CANCELLED,
}

@Serializable
public enum class ExchangeItemSide {
    INITIATOR,
    RECIPIENT,
}
