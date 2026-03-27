package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

@Serializable
public enum class SupportTicketStatus {
    OPEN,
    IN_PROGRESS,
    RESOLVED,
    CLOSED,
}

/** Priority level for a support ticket. Maps to the `support_ticket_priority` PG enum. */
@Serializable
public enum class SupportTicketPriority {
    LOW,
    NORMAL,
    HIGH,
    URGENT,
}

/**
 * Subject category for a support ticket. Maps to the `support_ticket_category` PG enum.
 *
 * Note: the PG enum uses `DRAW_DISPUTE` (not `DRAW_ISSUE`); this enum matches exactly.
 */
@Serializable
public enum class SupportTicketCategory {
    DRAW_DISPUTE,
    TRADE_DISPUTE,
    PAYMENT_ISSUE,
    ACCOUNT_ISSUE,
    SHIPPING_ISSUE,
    OTHER,
}
