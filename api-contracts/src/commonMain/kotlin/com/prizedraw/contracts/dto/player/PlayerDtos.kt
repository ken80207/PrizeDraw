package com.prizedraw.contracts.dto.player

import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.RevenuePointTxType
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class PlayerDto(
    val id: String,
    val playerCode: String,
    val nickname: String,
    val avatarUrl: String? = null,
    val phoneNumber: String?,
    val drawPointsBalance: Int,
    val revenuePointsBalance: Int,
    val preferredAnimationMode: DrawAnimationMode,
    val locale: String,
    val isActive: Boolean,
    val createdAt: Instant,
    val followerCount: Int,
    val followingCount: Int,
)

@Serializable
public data class UpdatePlayerRequest(
    val nickname: String? = null,
    val avatarUrl: String? = null,
    val locale: String? = null,
)

@Serializable
public data class WalletDto(
    val drawPointsBalance: Int,
    val revenuePointsBalance: Int,
    val drawTransactions: List<DrawPointTransactionDto>,
    val revenueTransactions: List<RevenuePointTransactionDto>,
)

@Serializable
public data class DrawPointTransactionDto(
    val id: String,
    val type: DrawPointTxType,
    val amount: Int,
    val balanceAfter: Int,
    val description: String?,
    val createdAt: Instant,
)

@Serializable
public data class RevenuePointTransactionDto(
    val id: String,
    val type: RevenuePointTxType,
    val amount: Int,
    val balanceAfter: Int,
    val description: String?,
    val createdAt: Instant,
)
