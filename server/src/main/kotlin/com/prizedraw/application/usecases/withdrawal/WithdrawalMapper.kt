package com.prizedraw.application.usecases.withdrawal

import com.prizedraw.contracts.dto.withdrawal.WithdrawalRequestDto
import com.prizedraw.domain.entities.WithdrawalRequest

private const val MASKED_DIGITS = 4

/** Converts a [WithdrawalRequest] domain entity to its DTO representation. */
internal fun WithdrawalRequest.toDto(): WithdrawalRequestDto =
    WithdrawalRequestDto(
        id = id.toString(),
        playerId = playerId.value.toString(),
        pointsAmount = pointsAmount,
        fiatAmount = fiatAmount,
        currencyCode = currencyCode,
        bankName = bankName,
        bankCode = bankCode,
        accountHolderName = accountHolderName,
        accountNumberMasked = accountNumber.takeLast(MASKED_DIGITS).padStart(accountNumber.length, '*'),
        status = status,
        rejectionReason = rejectionReason,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
