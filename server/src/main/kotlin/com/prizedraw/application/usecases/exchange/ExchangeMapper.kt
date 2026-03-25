package com.prizedraw.application.usecases.exchange

import com.prizedraw.contracts.dto.exchange.ExchangeItemDto
import com.prizedraw.contracts.dto.exchange.ExchangeOfferDto
import com.prizedraw.contracts.enums.ExchangeItemSide
import com.prizedraw.domain.entities.ExchangeRequest
import com.prizedraw.domain.entities.ExchangeRequestItem
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.PrizeInstance

/**
 * Maps domain entities to the [ExchangeOfferDto] contract representation.
 */
internal fun ExchangeRequest.toDto(
    initiator: Player,
    recipient: Player,
    items: List<ExchangeRequestItem>,
    instanceMap: Map<String, PrizeInstance>,
    definitionMap: Map<String, PrizeDefinition>,
): ExchangeOfferDto {
    val initiatorItems =
        items
            .filter { it.side == ExchangeItemSide.INITIATOR }
            .mapNotNull { item ->
                val instance = instanceMap[item.prizeInstanceId.value.toString()] ?: return@mapNotNull null
                val definition = definitionMap[instance.prizeDefinitionId.value.toString()] ?: return@mapNotNull null
                ExchangeItemDto(
                    prizeInstanceId = item.prizeInstanceId.value.toString(),
                    grade = definition.grade,
                    prizeName = definition.name,
                    prizePhotoUrl = definition.photos.firstOrNull() ?: "",
                )
            }
    val recipientItems =
        items
            .filter { it.side == ExchangeItemSide.RECIPIENT }
            .mapNotNull { item ->
                val instance = instanceMap[item.prizeInstanceId.value.toString()] ?: return@mapNotNull null
                val definition = definitionMap[instance.prizeDefinitionId.value.toString()] ?: return@mapNotNull null
                ExchangeItemDto(
                    prizeInstanceId = item.prizeInstanceId.value.toString(),
                    grade = definition.grade,
                    prizeName = definition.name,
                    prizePhotoUrl = definition.photos.firstOrNull() ?: "",
                )
            }
    return ExchangeOfferDto(
        id = id.toString(),
        initiatorId = initiatorId.value.toString(),
        initiatorNickname = initiator.nickname,
        recipientId = recipientId.value.toString(),
        recipientNickname = recipient.nickname,
        initiatorItems = initiatorItems,
        recipientItems = recipientItems,
        status = status,
        message = message,
        createdAt = createdAt,
    )
}
