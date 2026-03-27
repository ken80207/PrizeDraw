package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

/** Communication channel for a support ticket message. */
@Serializable
public enum class MessageChannel {
    /** Sent/received via the in-app platform chat. */
    PLATFORM,

    /** Sent/received via LINE Official Account integration. */
    LINE,
}
