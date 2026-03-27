package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

/**
 * Lifecycle state of an individual draw ticket slot within a [TicketBox].
 *
 * - [AVAILABLE] — the ticket has not yet been drawn.
 * - [DRAWN]     — the ticket has been drawn and a prize instance created.
 */
@Serializable
public enum class DrawTicketStatus {
    AVAILABLE,
    DRAWN,
}
