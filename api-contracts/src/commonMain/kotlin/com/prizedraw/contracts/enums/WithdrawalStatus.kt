package com.prizedraw.contracts.enums

import kotlinx.serialization.Serializable

@Serializable
public enum class WithdrawalStatus {
    PENDING_REVIEW,
    APPROVED,
    TRANSFERRED,
    REJECTED,
}
