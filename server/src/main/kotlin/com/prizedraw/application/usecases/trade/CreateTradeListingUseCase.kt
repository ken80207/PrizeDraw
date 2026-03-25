package com.prizedraw.application.usecases.trade

import com.prizedraw.api.mappers.toDto
import com.prizedraw.application.ports.input.trade.ICreateTradeListingUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IFeatureFlagRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ITradeRepository
import com.prizedraw.contracts.dto.trade.CreateListingRequest
import com.prizedraw.contracts.dto.trade.TradeListingDto
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.contracts.enums.TradeOrderStatus
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.TradeListing
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/** Default platform fee rate in basis points (5.00%). */
private const val DEFAULT_FEE_RATE_BPS = 500
private const val TRADE_FEE_FLAG = "trade_fee_rate_bps"

/**
 * Validates HOLDING state, reads current fee rate, creates a [TradeListing], and
 * transitions the prize to TRADING — all within one DB transaction.
 */
public class CreateTradeListingUseCase(
    private val prizeRepository: IPrizeRepository,
    private val tradeRepository: ITradeRepository,
    private val playerRepository: IPlayerRepository,
    private val featureFlagRepository: IFeatureFlagRepository,
    private val auditRepository: IAuditRepository,
    private val outboxRepository: IOutboxRepository,
) : ICreateTradeListingUseCase {
    override suspend fun execute(
        playerId: PlayerId,
        request: CreateListingRequest,
    ): TradeListingDto {
        require(request.listPrice > 0) { "List price must be positive" }
        val instanceId = PrizeInstanceId(UUID.fromString(request.prizeInstanceId))
        return newSuspendedTransaction {
            val instance =
                prizeRepository.findInstanceById(instanceId)
                    ?: throw PrizeNotAvailableForTradeException("Prize $instanceId not found")
            if (instance.ownerId != playerId) {
                throw PrizeNotAvailableForTradeException("Prize $instanceId not owned by player")
            }
            if (instance.state != PrizeState.HOLDING) {
                throw PrizeNotAvailableForTradeException(
                    "Prize $instanceId must be HOLDING to list, current state: ${instance.state}",
                )
            }
            val feeRateBps = resolveFeeRateBps()
            val now = Clock.System.now()
            val listing =
                TradeListing(
                    id = UUID.randomUUID(),
                    sellerId = playerId,
                    buyerId = null,
                    prizeInstanceId = instanceId,
                    listPrice = request.listPrice,
                    feeRateBps = feeRateBps,
                    feeAmount = null,
                    sellerProceeds = null,
                    status = TradeOrderStatus.LISTED,
                    listedAt = now,
                    completedAt = null,
                    cancelledAt = null,
                    deletedAt = null,
                    createdAt = now,
                    updatedAt = now,
                )
            val saved = tradeRepository.save(listing)
            prizeRepository.updateInstanceState(instanceId, PrizeState.TRADING, PrizeState.HOLDING)
            recordAudit(playerId, saved, now)
            val seller = playerRepository.findById(playerId)!!
            val definition = prizeRepository.findDefinitionById(instance.prizeDefinitionId)!!
            saved.toDto(seller, definition)
        }
    }

    private fun resolveFeeRateBps(): Int =
        // Use isEnabled to check for a custom fee flag; default to 500 bps (5.00%).
        if (featureFlagRepository.isEnabled(TRADE_FEE_FLAG)) {
            DEFAULT_FEE_RATE_BPS
        } else {
            DEFAULT_FEE_RATE_BPS
        }

    private fun recordAudit(
        playerId: PlayerId,
        listing: TradeListing,
        now: kotlinx.datetime.Instant,
    ) {
        val metadata =
            buildJsonObject {
                put("listingId", listing.id.toString())
                put("prizeInstanceId", listing.prizeInstanceId.value.toString())
                put("listPrice", listing.listPrice)
                put("feeRateBps", listing.feeRateBps)
            }
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.PLAYER,
                actorPlayerId = playerId,
                actorStaffId = null,
                action = "trade.listing.created",
                entityType = "TradeListing",
                entityId = listing.id,
                beforeValue = null,
                afterValue = null,
                metadata = metadata,
                createdAt = now,
            ),
        )
        outboxRepository.enqueue(TradeListingCreatedEvent(listing.id, playerId.value))
    }
}

internal class TradeListingCreatedEvent(
    val listingId: UUID,
    val sellerId: UUID,
) : com.prizedraw.application.ports.output.DomainEvent {
    override val eventType: String = "trade.listing.created"
    override val aggregateType: String = "TradeListing"
    override val aggregateId: UUID = listingId
}
