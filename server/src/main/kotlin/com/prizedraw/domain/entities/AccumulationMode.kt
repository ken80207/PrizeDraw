package com.prizedraw.domain.entities

/** How pity draw count accumulates: persisted across sessions or reset on session timeout. */
public enum class AccumulationMode {
    /** Draw count persists indefinitely across sessions. */
    PERSISTENT,

    /** Draw count resets if the player does not draw within [PityRule.sessionTimeoutSeconds]. */
    SESSION,
}
