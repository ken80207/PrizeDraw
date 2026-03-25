package com.prizedraw.application.usecases.player

import com.prizedraw.application.ports.input.player.IGetPrizeInventoryUseCase
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.contracts.dto.prize.PrizeInstanceDto
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.PrizeInstance
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId

/** States that appear in the player's active inventory. */
private val inventoryStates =
    setOf(
        PrizeState.HOLDING,
        PrizeState.TRADING,
        PrizeState.EXCHANGING,
        PrizeState.PENDING_SHIPMENT,
        PrizeState.SHIPPED,
    )

/**
 * Returns the player's active prize inventory joined with [PrizeDefinition] info.
 */
public class GetPrizeInventoryUseCase(
    private val prizeRepository: IPrizeRepository,
) : IGetPrizeInventoryUseCase {
    override suspend fun list(playerId: PlayerId): List<PrizeInstanceDto> {
        val all = prizeRepository.findInstancesByOwner(ownerId = playerId)
        val active = all.filter { it.state in inventoryStates && it.deletedAt == null }
        return active.mapNotNull { instance -> enrichInstance(instance) }
    }

    override suspend fun getOne(
        playerId: PlayerId,
        instanceId: PrizeInstanceId,
    ): PrizeInstanceDto {
        val instance =
            prizeRepository.findInstanceById(instanceId)
                ?: throw PrizeNotFoundException("Prize instance $instanceId not found")
        if (instance.ownerId != playerId) {
            throw PrizeNotFoundException("Prize instance $instanceId not owned by player")
        }
        return enrichInstance(instance)
            ?: throw PrizeNotFoundException("Prize definition for instance $instanceId not found")
    }

    private suspend fun enrichInstance(instance: PrizeInstance): PrizeInstanceDto? {
        val definition =
            prizeRepository.findDefinitionById(instance.prizeDefinitionId)
                ?: return null
        return instance.toDto(definition)
    }
}

private fun PrizeInstance.toDto(definition: PrizeDefinition): PrizeInstanceDto =
    PrizeInstanceDto(
        id = id.value.toString(),
        prizeDefinitionId = prizeDefinitionId.value.toString(),
        grade = definition.grade,
        name = definition.name,
        photoUrl = definition.photos.firstOrNull(),
        state = state,
        acquisitionMethod = acquisitionMethod.name,
        acquiredAt = acquiredAt,
    )
