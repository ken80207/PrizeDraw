package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

@Serializable
public enum class SupportTicketStatus {
    OPEN,
    IN_PROGRESS,
    RESOLVED,
    CLOSED,
}

@Serializable
public enum class SupportTicketCategory {
    TRADE_DISPUTE,
    DRAW_ISSUE,
    ACCOUNT_ISSUE,
    SHIPPING_ISSUE,
    PAYMENT_ISSUE,
    OTHER,
}
