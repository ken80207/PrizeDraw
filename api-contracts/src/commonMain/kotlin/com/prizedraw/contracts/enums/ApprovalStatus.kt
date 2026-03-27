package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

/** Approval status for campaign activation when margin is below threshold. */
@Serializable
public enum class ApprovalStatus {
    NOT_REQUIRED,
    PENDING,
    APPROVED,
    REJECTED,
}
