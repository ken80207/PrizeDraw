package com.prizedraw.contracts.dto.withdrawal

import com.prizedraw.contracts.enums.WithdrawalStatus
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

/** Request body for submitting a new withdrawal. */
@Serializable
public data class CreateWithdrawalRequest(
    val pointsAmount: Int,
    val bankName: String,
    val bankCode: String,
    val accountHolderName: String,
    val accountNumber: String,
)

/** Response body for a withdrawal request. */
@Serializable
public data class WithdrawalRequestDto(
    val id: String,
    val playerId: String,
    val pointsAmount: Int,
    val fiatAmount: Int,
    val currencyCode: String,
    val bankName: String,
    val bankCode: String,
    val accountHolderName: String,
    /** Last four digits only — never the full account number. */
    val accountNumberMasked: String,
    val status: WithdrawalStatus,
    val rejectionReason: String?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

/** Admin-only request body for rejecting a withdrawal. */
@Serializable
public data class RejectWithdrawalRequest(
    val reason: String,
)
