package com.prizedraw.contracts.dto.trade

import com.prizedraw.contracts.enums.TradeOrderStatus
import kotlinx.datetime.Instant
import kotlinx.serialization.Serializable

@Serializable
public data class TradeListingDto(
    val id: String,
    val sellerId: String,
    val sellerNickname: String,
    val prizeInstanceId: String,
    val prizeGrade: String,
    val prizeName: String,
    val prizePhotoUrl: String,
    val listPrice: Int,
    val feeRateBps: Int,
    val status: TradeOrderStatus,
    val listedAt: Instant,
)

@Serializable
public data class CreateListingRequest(
    val prizeInstanceId: String,
    val listPrice: Int,
)

@Serializable
public data class PurchaseListingRequest(
    val listingId: String,
)

@Serializable
public data class TradeListingPageDto(
    val items: List<TradeListingDto>,
    val totalCount: Int,
    val page: Int,
    val pageSize: Int,
)
