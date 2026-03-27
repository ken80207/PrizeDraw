package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

/** Who performed the action recorded in an audit log entry. */
@Serializable
public enum class AuditActorType {
    PLAYER,
    STAFF,
    SYSTEM,
}
