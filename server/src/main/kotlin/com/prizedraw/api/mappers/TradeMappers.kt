package com.prizedraw.api.mappers

import com.prizedraw.contracts.dto.trade.TradeListingDto
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.TradeListing

/**
 * Maps a [TradeListing] domain entity to its [TradeListingDto], enriched with
 * seller nickname and prize definition details.
 */
public fun TradeListing.toDto(
    seller: Player,
    definition: PrizeDefinition,
): TradeListingDto =
    TradeListingDto(
        id = id.toString(),
        sellerId = sellerId.value.toString(),
        sellerNickname = seller.nickname,
        prizeInstanceId = prizeInstanceId.value.toString(),
        prizeGrade = definition.grade,
        prizeName = definition.name,
        prizePhotoUrl = definition.photos.firstOrNull() ?: "",
        listPrice = listPrice,
        feeRateBps = feeRateBps,
        status = status,
        listedAt = listedAt,
    )
