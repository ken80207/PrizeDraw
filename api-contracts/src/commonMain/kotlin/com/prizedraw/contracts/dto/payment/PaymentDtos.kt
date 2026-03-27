package com.prizedraw.contracts.dto.payment

import com.prizedraw.contracts.enums.PaymentGateway
import com.prizedraw.contracts.enums.WithdrawalStatus
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class PaymentIntentDto(
    val paymentOrderId: String,
    val gateway: PaymentGateway,
    val checkoutUrl: String?,
    val expiresAt: Instant?,
)

@Serializable
public data class CreatePaymentOrderRequest(
    val pointsPackageId: String,
)

@Serializable
public data class PointsPackageDto(
    val id: String,
    val drawPointsAmount: Int,
    val fiatAmount: Int,
    val currencyCode: String,
    val label: String,
    val isActive: Boolean,
)

@Serializable
public data class PaymentWebhookPayload(
    val gateway: PaymentGateway,
    val transactionId: String,
    val merchantOrderId: String,
    val status: String,
    val amount: Int,
    val metadata: Map<String, String>,
)

@Serializable
public data class WithdrawalRequestDto(
    val id: String,
    val pointsAmount: Int,
    val fiatAmount: Int,
    val currencyCode: String,
    val bankName: String,
    val bankCode: String,
    val accountHolderName: String,
    val status: WithdrawalStatus,
    val reviewedAt: Instant?,
    val createdAt: Instant,
)

@Serializable
public data class CreateWithdrawalRequest(
    val pointsAmount: Int,
    val bankName: String,
    val bankCode: String,
    val accountHolderName: String,
    val accountNumber: String,
)

/**
 * Request body for the mock instant top-up endpoint.
 *
 * For development and testing use only. Credits [points] draw points directly to the
 * authenticated player without going through a real payment gateway.
 *
 * @property points Number of draw points to credit. Must be between 1 and 100 000 inclusive.
 */
@Serializable
public data class MockTopUpRequest(
    val points: Int,
)

/**
 * Response body for the mock instant top-up endpoint.
 *
 * @property pointsCredited The number of draw points that were credited.
 * @property newBalance The player's draw-point balance after the top-up.
 */
@Serializable
public data class MockTopUpResponse(
    val pointsCredited: Int,
    val newBalance: Int,
)
