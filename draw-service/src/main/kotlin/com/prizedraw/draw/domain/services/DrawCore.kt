@file:Suppress("BracesOnIfStatements")

package com.prizedraw.draw.domain.services

import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.draw.application.events.DrawCompleted
import com.prizedraw.draw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.draw.application.ports.output.IOutboxRepository
import com.prizedraw.draw.application.ports.output.IPlayerRepository
import com.prizedraw.draw.application.ports.output.IPrizeRepository
import com.prizedraw.draw.application.services.LevelService
import com.prizedraw.draw.domain.entities.DrawPointTransaction
import com.prizedraw.draw.domain.entities.PrizeAcquisitionMethod
import com.prizedraw.draw.domain.entities.PrizeInstance
import com.prizedraw.draw.domain.valueobjects.PlayerId
import com.prizedraw.draw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.draw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import org.slf4j.LoggerFactory
import java.security.SecureRandom
import java.util.UUID

/**
 * One entry in the draw prize pool passed to [DrawCore].
 *
 * Core does not care about grade, name, or display info.
 */
public data class PrizePoolEntry(
    val prizeDefinitionId: UUID,
    val weight: Int,
    val metadata: Map<String, String> = emptyMap(),
)

/**
 * The result returned by [DrawCore.draw] for each draw.
 *
 * Application layer resolves grade/name/photos from [prizeDefinitionId].
 */
public data class DrawOutcome(
    val prizeDefinitionId: UUID,
    val prizeInstanceId: PrizeInstanceId,
    val pointsCharged: Int,
    val metadata: Map<String, String>,
)

/** Dependency container for [DrawCore]. */
public data class DrawCoreDeps(
    val playerRepository: IPlayerRepository,
    val prizeRepository: IPrizeRepository,
    val drawPointTxRepository: IDrawPointTransactionRepository,
    val outboxRepository: IOutboxRepository,
    val levelService: LevelService? = null,
)

private const val MAX_BALANCE_RETRIES = 3
private const val DRAW_XP_PER_POINT = 1

/**
 * Core draw engine shared by all campaign types (draw-service copy).
 *
 * Responsibilities: weighted random selection → balance debit → [PrizeInstance] creation
 * → ledger record → outbox event → XP award.
 * Not responsible for: queuing, rate limiting, inventory management, display info.
 *
 * Must be called within an active `newSuspendedTransaction`.
 */
public class DrawCore(
    private val deps: DrawCoreDeps,
) {
    private val log = LoggerFactory.getLogger(DrawCore::class.java)
    private val secureRandom = SecureRandom()

    /**
     * Executes one or more draws.
     *
     * @param playerId Who is drawing.
     * @param pool Prize pool assembled by the application layer.
     * @param quantity Number of draws (samples from the same pool with replacement).
     * @param pricePerDraw Cost per single draw in points.
     * @param discountAmount Coupon discount applied to the total cost.
     * @param gameType Label written to the draw-point ledger description.
     * @param preSelected Pre-determined results (e.g. kuji); skips random selection when non-null.
     * @return List of [DrawOutcome]s, one per draw.
     */
    @Suppress("LongMethod")
    public suspend fun draw(
        playerId: PlayerId,
        pool: List<PrizePoolEntry>,
        quantity: Int,
        pricePerDraw: Int,
        discountAmount: Int = 0,
        gameType: String = "UNKNOWN",
        preSelected: List<PrizePoolEntry>? = null,
    ): List<DrawOutcome> {
        require(pool.isNotEmpty()) { "Prize pool must not be empty" }
        require(quantity > 0) { "Quantity must be positive" }

        val totalCost = (pricePerDraw * quantity - discountAmount).coerceAtLeast(0)
        val now = Clock.System.now()

        val selected = preSelected ?: (1..quantity).map { spinOnce(pool) }

        debitBalance(playerId, totalCost, now)

        return selected
            .map { entry ->
                val instanceId = PrizeInstanceId(UUID.randomUUID())
                val perCost = if (quantity == 1) totalCost else pricePerDraw

                deps.prizeRepository.saveInstance(
                    PrizeInstance(
                        id = instanceId,
                        prizeDefinitionId = PrizeDefinitionId(entry.prizeDefinitionId),
                        ownerId = playerId,
                        acquisitionMethod = PrizeAcquisitionMethod.KUJI_DRAW,
                        sourceDrawTicketId = entry.metadata["ticketId"]?.let { UUID.fromString(it) },
                        sourceTradeOrderId = null,
                        sourceExchangeRequestId = null,
                        state = PrizeState.HOLDING,
                        acquiredAt = now,
                        deletedAt = null,
                        createdAt = now,
                        updatedAt = now,
                    ),
                )

                deps.drawPointTxRepository.record(
                    DrawPointTransaction(
                        id = UUID.randomUUID(),
                        playerId = playerId,
                        type = DrawPointTxType.KUJI_DRAW_DEBIT,
                        amount = -perCost,
                        balanceAfter = 0,
                        paymentOrderId = null,
                        description = "$gameType draw",
                        createdAt = now,
                    ),
                )

                deps.outboxRepository.enqueue(
                    DrawCompleted(
                        ticketId = entry.metadata["ticketId"]?.let { UUID.fromString(it) } ?: UUID.randomUUID(),
                        playerId = playerId.value,
                        prizeInstanceId = instanceId.value,
                        campaignId = UUID.randomUUID(),
                    ),
                )

                DrawOutcome(
                    prizeDefinitionId = entry.prizeDefinitionId,
                    prizeInstanceId = instanceId,
                    pointsCharged = perCost,
                    metadata = entry.metadata,
                )
            }.also {
                awardXp(playerId, pricePerDraw * quantity)
            }
    }

    private fun spinOnce(pool: List<PrizePoolEntry>): PrizePoolEntry {
        val totalWeight = pool.sumOf { it.weight }
        require(totalWeight > 0) { "Total weight must be positive" }
        val roll = secureRandom.nextInt(totalWeight)
        var cumulative = 0
        for (entry in pool) {
            cumulative += entry.weight
            if (roll < cumulative) return entry
        }
        return pool.last()
    }

    @Suppress("UNUSED_PARAMETER")
    private suspend fun debitBalance(
        playerId: PlayerId,
        totalCost: Int,
        now: Instant,
    ) {
        if (totalCost <= 0) return
        repeat(MAX_BALANCE_RETRIES) {
            val player =
                deps.playerRepository.findById(playerId)
                    ?: error("Player ${playerId.value} not found")
            if (player.drawPointsBalance < totalCost) {
                error("Insufficient balance: has ${player.drawPointsBalance}, needs $totalCost")
            }
            val ok =
                deps.playerRepository.updateBalance(
                    id = playerId,
                    drawPointsDelta = -totalCost,
                    revenuePointsDelta = 0,
                    expectedVersion = player.version,
                )
            if (ok) return
        }
        error("Failed to debit balance after $MAX_BALANCE_RETRIES retries")
    }

    private suspend fun awardXp(
        playerId: PlayerId,
        totalSpent: Int,
    ) {
        val svc = deps.levelService ?: return
        try {
            svc.awardXp(playerId, totalSpent * DRAW_XP_PER_POINT)
        } catch (
            @Suppress("TooGenericExceptionCaught") ex: Exception,
        ) {
            log.warn("Failed to award XP for ${playerId.value}: ${ex.message}")
        }
    }
}
