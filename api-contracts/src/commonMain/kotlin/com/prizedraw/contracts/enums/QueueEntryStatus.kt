package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

@Serializable
public enum class QueueEntryStatus {
    WAITING,
    ACTIVE,
    COMPLETED,
    ABANDONED,
    EVICTED,
}

@Serializable
public enum class DrawAnimationMode {
    TEAR,
    SCRATCH,
    FLIP,
    INSTANT,
}
