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
