package com.prizedraw.application.usecases.buyback

import com.prizedraw.application.ports.input.buyback.IBuybackUseCase
import com.prizedraw.application.ports.input.buyback.IGetBuybackPriceUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IBuybackRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IRevenuePointTransactionRepository
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.contracts.enums.RevenuePointTxType
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.BuybackRecord
import com.prizedraw.domain.entities.RevenuePointTransaction
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

private const val MAX_BALANCE_RETRIES = 5

/**
 * Executes a prize buyback in a single atomic DB transaction:
 * 1. Validate prize is HOLDING and owned by player.
 * 2. Validate buyback is enabled on the [PrizeDefinition].
 * 3. Snapshot buyback_price from definition.
 * 4. Create [BuybackRecord], set prize RECYCLED, credit revenue_points_balance,
 *    insert [RevenuePointTransaction](BUYBACK_CREDIT), insert [AuditLog].
 * 5. Enqueue [BuybackCompletedEvent] outbox event.
 */
public class BuybackUseCase(
    private val prizeRepository: IPrizeRepository,
    private val playerRepository: IPlayerRepository,
    private val buybackRepository: IBuybackRepository,
    private val revenuePointTxRepository: IRevenuePointTransactionRepository,
    private val auditRepository: IAuditRepository,
    private val outboxRepository: IOutboxRepository,
) : IBuybackUseCase {
    override suspend fun execute(
        playerId: PlayerId,
        prizeInstanceId: PrizeInstanceId,
    ): Int =
        newSuspendedTransaction {
            val instance =
                prizeRepository.findInstanceById(prizeInstanceId)
                    ?: throw PrizeNotAvailableForBuybackException("Prize $prizeInstanceId not found")
            if (instance.ownerId != playerId) {
                throw PrizeNotAvailableForBuybackException("Prize $prizeInstanceId not owned by player")
            }
            if (instance.state != PrizeState.HOLDING) {
                throw PrizeNotAvailableForBuybackException(
                    "Prize $prizeInstanceId must be HOLDING, current: ${instance.state}",
                )
            }
            val definition =
                prizeRepository.findDefinitionById(instance.prizeDefinitionId)
                    ?: throw PrizeNotAvailableForBuybackException("Prize definition not found")
            if (!definition.buybackEnabled) {
                throw BuybackDisabledException(
                    "Buyback is not enabled for prize grade ${definition.grade}",
                )
            }
            val snapshotPrice = definition.buybackPrice
            val now = Clock.System.now()
            val record =
                BuybackRecord(
                    id = UUID.randomUUID(),
                    playerId = playerId,
                    prizeInstanceId = prizeInstanceId,
                    prizeDefinitionId = instance.prizeDefinitionId,
                    buybackPrice = snapshotPrice,
                    processedAt = now,
                    createdAt = now,
                )
            buybackRepository.save(record)
            prizeRepository.updateInstanceState(prizeInstanceId, PrizeState.RECYCLED, PrizeState.HOLDING)
            creditRevenuePointsWithRetry(playerId, snapshotPrice, record.id, now)
            auditRepository.record(
                AuditLog(
                    id = UUID.randomUUID(),
                    actorType = AuditActorType.PLAYER,
                    actorPlayerId = playerId,
                    actorStaffId = null,
                    action = "buyback.completed",
                    entityType = "BuybackRecord",
                    entityId = record.id,
                    beforeValue = null,
                    afterValue =
                        buildJsonObject {
                            put("prizeInstanceId", prizeInstanceId.value.toString())
                            put("buybackPrice", snapshotPrice)
                        },
                    metadata = kotlinx.serialization.json.buildJsonObject { },
                    createdAt = now,
                ),
            )
            outboxRepository.enqueue(BuybackCompletedEvent(record.id, playerId.value))
            snapshotPrice
        }

    private suspend fun creditRevenuePointsWithRetry(
        playerId: PlayerId,
        amount: Int,
        buybackRecordId: UUID,
        now: kotlinx.datetime.Instant,
    ) {
        repeat(MAX_BALANCE_RETRIES) { attempt ->
            val player = playerRepository.findById(playerId)!!
            val updated = playerRepository.updateBalance(playerId, 0, amount, player.version)
            if (updated) {
                revenuePointTxRepository.record(
                    RevenuePointTransaction(
                        id = UUID.randomUUID(),
                        playerId = playerId,
                        type = RevenuePointTxType.BUYBACK_CREDIT,
                        amount = amount,
                        balanceAfter = player.revenuePointsBalance + amount,
                        tradeOrderId = null,
                        description = "Buyback credit: record $buybackRecordId",
                        createdAt = now,
                    ),
                )
                return
            }
            org.slf4j.LoggerFactory
                .getLogger(BuybackUseCase::class.java)
                .warn("Buyback credit lock failed for ${playerId.value}, attempt ${attempt + 1}")
        }
        error("Failed to credit buyback revenue points for ${playerId.value} after $MAX_BALANCE_RETRIES attempts")
    }
}

/**
 * Returns the current buyback price for a prize without committing.
 */
public class GetBuybackPriceUseCase(
    private val prizeRepository: IPrizeRepository,
) : IGetBuybackPriceUseCase {
    override suspend fun execute(
        playerId: PlayerId,
        prizeInstanceId: PrizeInstanceId,
    ): Int {
        val instance =
            prizeRepository.findInstanceById(prizeInstanceId)
                ?: throw PrizeNotAvailableForBuybackException("Prize $prizeInstanceId not found")
        if (instance.ownerId != playerId) {
            throw PrizeNotAvailableForBuybackException("Prize $prizeInstanceId not owned by player")
        }
        val definition =
            prizeRepository.findDefinitionById(instance.prizeDefinitionId)
                ?: throw PrizeNotAvailableForBuybackException("Prize definition not found")
        if (!definition.buybackEnabled) {
            throw BuybackDisabledException("Buyback is not enabled for this prize")
        }
        return definition.buybackPrice
    }
}

internal class BuybackCompletedEvent(
    val buybackRecordId: UUID,
    val playerId: UUID,
) : com.prizedraw.application.ports.output.DomainEvent {
    override val eventType: String = "buyback.completed"
    override val aggregateType: String = "BuybackRecord"
    override val aggregateId: UUID = buybackRecordId
}
