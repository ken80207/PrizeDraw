package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.IUpdateBuybackPriceUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/**
 * Updates [PrizeDefinition.buybackPrice] and [PrizeDefinition.buybackEnabled] for
 * the given definition and records a before/after audit log entry.
 *
 * Validates:
 * - [buybackPrice] >= 0 (zero effectively disables economic buyback value).
 */
public class UpdateBuybackPriceUseCase(
    private val prizeRepository: IPrizeRepository,
    private val auditRepository: IAuditRepository,
) : IUpdateBuybackPriceUseCase {
    override suspend fun execute(
        staffId: StaffId,
        prizeDefinitionId: PrizeDefinitionId,
        buybackPrice: Int,
        buybackEnabled: Boolean,
    ): PrizeDefinition {
        if (buybackPrice < 0) {
            throw InvalidBuybackPriceException(buybackPrice)
        }

        val existing =
            prizeRepository.findDefinitionById(prizeDefinitionId)
                ?: throw PrizeDefinitionNotFoundException(prizeDefinitionId.value.toString())

        val updated =
            existing.copy(
                buybackPrice = buybackPrice,
                buybackEnabled = buybackEnabled,
                updatedAt = Clock.System.now(),
            )

        val saved = prizeRepository.saveDefinition(updated)
        recordAudit(staffId, existing, saved)
        return saved
    }

    private fun recordAudit(
        staffId: StaffId,
        before: PrizeDefinition,
        after: PrizeDefinition,
    ) {
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = staffId.value,
                action = "prize.buybackPrice.updated",
                entityType = "PrizeDefinition",
                entityId = before.id.value,
                beforeValue =
                    buildJsonObject {
                        put("buybackPrice", before.buybackPrice)
                        put("buybackEnabled", before.buybackEnabled)
                    },
                afterValue =
                    buildJsonObject {
                        put("buybackPrice", after.buybackPrice)
                        put("buybackEnabled", after.buybackEnabled)
                    },
                metadata = buildJsonObject { put("staffId", staffId.value.toString()) },
                createdAt = Clock.System.now(),
            ),
        )
    }
}
