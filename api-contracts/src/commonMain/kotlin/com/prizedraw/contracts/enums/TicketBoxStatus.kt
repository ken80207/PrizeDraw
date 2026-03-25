package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

/**
 * Status of a ticket box within a kuji campaign.
 *
 * - [AVAILABLE] — tickets remain in the box and can still be drawn.
 * - [SOLD_OUT]  — all tickets in this box have been drawn.
 */
@Serializable
public enum class TicketBoxStatus {
    AVAILABLE,
    SOLD_OUT,
}
