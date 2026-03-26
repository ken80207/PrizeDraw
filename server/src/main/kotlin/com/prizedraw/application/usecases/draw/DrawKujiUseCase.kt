package com.prizedraw.application.usecases.draw

import com.prizedraw.application.ports.input.draw.IDrawKujiUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.ICouponRepository
import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IDrawRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IQueueRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.application.services.LevelService
import com.prizedraw.contracts.dto.draw.DrawResultDto
import com.prizedraw.contracts.dto.draw.DrawnTicketResultDto
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.DrawPointTransaction
import com.prizedraw.domain.entities.DrawTicket
import com.prizedraw.domain.entities.PlayerCouponStatus
import com.prizedraw.domain.entities.PrizeAcquisitionMethod
import com.prizedraw.domain.entities.PrizeInstance
import com.prizedraw.domain.entities.Queue
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.entities.XpRules
import com.prizedraw.domain.entities.XpSourceType
import com.prizedraw.domain.services.KujiDrawDomainService
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.slf4j.LoggerFactory
import java.util.UUID
import com.prizedraw.domain.entities.TicketBoxStatus as DomainTicketBoxStatus

/** Thrown when the player is not the active session holder for the requested box. */
public class NotSessionHolderException(
    message: String,
) : IllegalStateException(message)

/** Thrown when the requested ticket box is not found. */
public class TicketBoxNotFoundException(
    id: UUID,
) : IllegalArgumentException("TicketBox $id not found")

/** Thrown when the player's point balance is insufficient for the draw. */
public class InsufficientPointsException(
    required: Int,
    available: Int,
) : IllegalStateException("Insufficient draw points: need $required, have $available")

/** Maximum number of optimistic lock retries for balance debit. */
private const val MAX_BALANCE_RETRIES = 3

/** Basis points denominator used to convert percentage discount values. */
private const val BPS_DENOMINATOR = 100.0

/**
 * Dependencies for [DrawKujiUseCase], grouped to satisfy detekt's parameter-count threshold.
 */
public data class DrawKujiDeps(
    val drawRepository: IDrawRepository,
    val ticketBoxRepository: ITicketBoxRepository,
    val prizeRepository: IPrizeRepository,
    val playerRepository: IPlayerRepository,
    val campaignRepository: ICampaignRepository,
    val queueRepository: IQueueRepository,
    val drawPointTxRepository: IDrawPointTransactionRepository,
    val outboxRepository: IOutboxRepository,
    val auditRepository: IAuditRepository,
    val domainService: KujiDrawDomainService,
    val redisPubSub: RedisPubSub,
    val couponRepository: ICouponRepository? = null,
    val levelService: LevelService? = null,
)

/**
 * Executes the full kuji draw transaction.
 *
 * Processing order per draw:
 * 1. Validate session holder via queue.
 * 2. Resolve tickets (explicit IDs or random selection).
 * 3. In a single DB transaction:
 *    a. Mark each ticket DRAWN.
 *    b. Create a [PrizeInstance] (HOLDING) per ticket.
 *    c. Debit draw points with optimistic lock retry (up to [MAX_BALANCE_RETRIES]).
 *    d. Record [DrawPointTransaction] ledger entry.
 *    e. Decrement [TicketBox.remainingTickets]; mark SOLD_OUT if 0.
 *    f. If all boxes sold out, mark campaign SOLD_OUT.
 *    g. Insert [AuditLog].
 * 4. Enqueue [DrawCompletedEvent] outbox event.
 * 5. Publish WebSocket event on `kuji:{campaignId}`.
 */
public class DrawKujiUseCase(
    private val deps: DrawKujiDeps,
) : IDrawKujiUseCase {
    private val log = LoggerFactory.getLogger(DrawKujiUseCase::class.java)

    override suspend fun execute(
        playerId: PlayerId,
        ticketBoxId: UUID,
        ticketIds: List<UUID>,
        quantity: Int,
        playerCouponId: UUID?,
    ): DrawResultDto {
        val box =
            deps.ticketBoxRepository.findById(ticketBoxId)
                ?: throw TicketBoxNotFoundException(ticketBoxId)
        val queue =
            deps.queueRepository.findByTicketBoxId(ticketBoxId)
                ?: throw NotSessionHolderException("No queue found for box $ticketBoxId")
        if (queue.activePlayerId != playerId) {
            throw NotSessionHolderException(
                "Player ${playerId.value} is not the active session holder",
            )
        }
        val resolvedTickets = resolveTickets(box, ticketIds, quantity, queue, playerId)
        val basePrice = resolvedTickets.size * getCampaignPrice(box.kujiCampaignId)
        val (totalCost, discountAmount) = resolveCouponDiscount(playerId, playerCouponId, basePrice)
        val results = executeDrawTransaction(playerId, box, resolvedTickets, totalCost, discountAmount, playerCouponId)
        publishDrawEvents(box, results, playerId)
        awardDrawXp(playerId, totalCost, box)
        return DrawResultDto(tickets = results)
    }

    @Suppress("ReturnCount")
    private suspend fun resolveCouponDiscount(
        playerId: PlayerId,
        playerCouponId: UUID?,
        basePrice: Int,
    ): Pair<Int, Int> {
        if (playerCouponId == null || deps.couponRepository == null) {
            return Pair(basePrice, 0)
        }
        val playerCoupon = deps.couponRepository.findPlayerCouponById(playerCouponId)
        if (playerCoupon == null || playerCoupon.playerId != playerId) {
            return Pair(basePrice, 0)
        }
        if (playerCoupon.status != PlayerCouponStatus.ACTIVE) {
            return Pair(basePrice, 0)
        }
        val coupon = deps.couponRepository.findCouponById(playerCoupon.couponId) ?: return Pair(basePrice, 0)
        if (!coupon.isActive) {
            return Pair(basePrice, 0)
        }
        val discountedPrice =
            when (coupon.discountType) {
                com.prizedraw.domain.entities.CouponDiscountType.PERCENTAGE -> {
                    val factor = (BPS_DENOMINATOR - coupon.discountValue) / BPS_DENOMINATOR
                    (basePrice * factor).toLong().toInt().coerceAtLeast(0)
                }
                com.prizedraw.domain.entities.CouponDiscountType.FIXED_POINTS ->
                    (basePrice - coupon.discountValue).coerceAtLeast(0)
            }
        return Pair(discountedPrice, basePrice - discountedPrice)
    }

    private suspend fun getCampaignPrice(campaignId: CampaignId): Int {
        val campaign = deps.campaignRepository.findKujiById(campaignId)
        checkNotNull(campaign) { "Campaign ${campaignId.value} not found" }
        return campaign.pricePerDraw
    }

    private suspend fun resolveTickets(
        box: TicketBox,
        ticketIds: List<UUID>,
        quantity: Int,
        queue: Queue,
        playerId: PlayerId,
    ): List<DrawTicket> =
        if (ticketIds.isNotEmpty()) {
            ticketIds.map { id ->
                val ticket =
                    deps.drawRepository.findTicketById(id)
                        ?: throw IllegalArgumentException("Ticket $id not found")
                deps.domainService.validateTicketSelection(ticket, queue, playerId)
                ticket
            }
        } else {
            deps.domainService.validateMultiDraw(box, quantity)
            val available = deps.drawRepository.findAvailableTickets(box.id)
            deps.domainService.selectRandomTickets(available, quantity)
        }

    @Suppress("LongMethod")
    private suspend fun executeDrawTransaction(
        playerId: PlayerId,
        box: TicketBox,
        tickets: List<DrawTicket>,
        totalCost: Int,
        discountAmount: Int,
        playerCouponId: UUID?,
    ): List<DrawnTicketResultDto> =
        newSuspendedTransaction {
            val now = Clock.System.now()
            val player = deps.playerRepository.findById(playerId)
            checkNotNull(player) { "Player ${playerId.value} not found" }
            if (player.drawPointsBalance < totalCost) {
                throw InsufficientPointsException(totalCost, player.drawPointsBalance)
            }
            if (playerCouponId != null && deps.couponRepository != null) {
                val pc = deps.couponRepository.findPlayerCouponById(playerCouponId)
                if (pc != null) {
                    deps.couponRepository.savePlayerCoupon(
                        pc.copy(
                            useCount = pc.useCount + 1,
                            status = PlayerCouponStatus.EXHAUSTED,
                            lastUsedAt = now,
                            updatedAt = now,
                        ),
                    )
                }
            }
            val perTicketCost =
                if (tickets.isNotEmpty()) {
                    totalCost / tickets.size
                } else {
                    0
                }
            val results =
                tickets.map { ticket ->
                    val prizeDefId = ticket.prizeDefinitionId
                    val prizeDef = deps.prizeRepository.findDefinitionById(prizeDefId)
                    checkNotNull(prizeDef) { "PrizeDefinition ${prizeDefId.value} not found" }
                    val instanceId = PrizeInstanceId(UUID.randomUUID())
                    deps.drawRepository.markDrawn(ticket.id, playerId, instanceId, now)
                    val instance =
                        PrizeInstance(
                            id = instanceId,
                            prizeDefinitionId = prizeDefId,
                            ownerId = playerId,
                            acquisitionMethod = PrizeAcquisitionMethod.KUJI_DRAW,
                            sourceDrawTicketId = ticket.id,
                            sourceTradeOrderId = null,
                            sourceExchangeRequestId = null,
                            state = PrizeState.HOLDING,
                            acquiredAt = now,
                            deletedAt = null,
                            createdAt = now,
                            updatedAt = now,
                        )
                    deps.prizeRepository.saveInstance(instance)
                    DrawnTicketResultDto(
                        ticketId = ticket.id.toString(),
                        position = ticket.position,
                        prizeInstanceId = instanceId.value.toString(),
                        grade = prizeDef.grade,
                        prizeName = prizeDef.name,
                        prizePhotoUrl = prizeDef.photos.firstOrNull() ?: "",
                        pointsCharged = perTicketCost,
                        discountApplied =
                            if (tickets.size == 1) {
                                discountAmount
                            } else {
                                0
                            },
                    )
                }
            debitBalanceWithRetry(playerId, totalCost, now)
            handleBoxSoldOut(box, tickets.size)
            recordAuditLog(playerId, box, tickets.size, totalCost, now)
            results
        }

    private suspend fun debitBalanceWithRetry(
        playerId: PlayerId,
        totalCost: Int,
        now: Instant,
    ) {
        repeat(MAX_BALANCE_RETRIES) { attempt ->
            val player = deps.playerRepository.findById(playerId)
            checkNotNull(player) { "Player ${playerId.value} not found" }
            val newBalance = player.drawPointsBalance - totalCost
            if (newBalance < 0) {
                throw InsufficientPointsException(totalCost, player.drawPointsBalance)
            }
            val updated =
                deps.playerRepository.updateBalance(
                    id = playerId,
                    drawPointsDelta = -totalCost,
                    revenuePointsDelta = 0,
                    expectedVersion = player.version,
                )
            if (updated) {
                val tx =
                    DrawPointTransaction(
                        id = UUID.randomUUID(),
                        playerId = playerId,
                        type = DrawPointTxType.KUJI_DRAW_DEBIT,
                        amount = -totalCost,
                        balanceAfter = newBalance,
                        paymentOrderId = null,
                        description = "Kuji draw debit",
                        createdAt = now,
                    )
                deps.drawPointTxRepository.record(tx)
                return
            }
            log.warn("Balance optimistic lock failed for player ${playerId.value}, attempt ${attempt + 1}")
        }
        error("Failed to debit balance for player ${playerId.value} after $MAX_BALANCE_RETRIES attempts")
    }

    private suspend fun handleBoxSoldOut(
        box: TicketBox,
        drawnCount: Int,
    ) {
        val newRemaining = box.remainingTickets - drawnCount
        if (newRemaining <= 0) {
            val now = Clock.System.now()
            val soldOutBox =
                box.copy(
                    remainingTickets = 0,
                    status = DomainTicketBoxStatus.SOLD_OUT,
                    soldOutAt = now,
                    updatedAt = now,
                )
            deps.ticketBoxRepository.save(soldOutBox)
            checkCampaignSoldOut(box.kujiCampaignId)
        }
    }

    private suspend fun checkCampaignSoldOut(campaignId: CampaignId) {
        val allBoxes = deps.ticketBoxRepository.findByCampaignId(campaignId)
        val allSoldOut = allBoxes.all { it.status == DomainTicketBoxStatus.SOLD_OUT }
        if (allSoldOut) {
            deps.campaignRepository.updateKujiStatus(campaignId, CampaignStatus.SOLD_OUT)
            log.info("Campaign ${campaignId.value} marked SOLD_OUT -- all boxes exhausted")
        }
    }

    private fun recordAuditLog(
        playerId: PlayerId,
        box: TicketBox,
        ticketCount: Int,
        totalCost: Int,
        now: Instant,
    ) {
        val metadata =
            buildJsonObject {
                put("ticketBoxId", box.id.toString())
                put("campaignId", box.kujiCampaignId.value.toString())
                put("ticketCount", ticketCount)
                put("totalCost", totalCost)
            }
        deps.auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.PLAYER,
                actorPlayerId = playerId,
                actorStaffId = null,
                action = "kuji.draw",
                entityType = "TicketBox",
                entityId = box.id,
                beforeValue = null,
                afterValue = null,
                metadata = metadata,
                createdAt = now,
            ),
        )
        deps.outboxRepository.enqueue(
            DrawCompletedEvent(box.kujiCampaignId.value, box.id, playerId.value),
        )
    }

    private suspend fun awardDrawXp(
        playerId: PlayerId,
        totalCost: Int,
        box: TicketBox,
    ) {
        val levelService = deps.levelService ?: return
        val xpAmount = totalCost * XpRules.XP_PER_DRAW_POINT
        runCatching {
            levelService.awardXp(
                playerId = playerId,
                amount = xpAmount,
                sourceType = XpSourceType.KUJI_DRAW,
                sourceId = box.id,
                description = "一番賞抽獎: box ${box.id}",
            )
        }.onFailure { ex ->
            log.warn("Failed to award XP for kuji draw by ${playerId.value}: ${ex.message}")
        }
    }

    private suspend fun publishDrawEvents(
        box: TicketBox,
        results: List<DrawnTicketResultDto>,
        playerId: PlayerId,
    ) {
        val player = deps.playerRepository.findById(playerId)
        val payload =
            buildJsonObject {
                put("type", "TICKET_DRAWN")
                put("campaignId", box.kujiCampaignId.value.toString())
                put("ticketBoxId", box.id.toString())
                put("drawnByNickname", player?.nickname ?: "Player")
                put("ticketCount", results.size)
            }
        deps.redisPubSub.publish("kuji:${box.kujiCampaignId.value}", payload.toString())
    }
}

/** Outbox domain event emitted after a successful kuji draw. */
internal class DrawCompletedEvent(
    val campaignId: UUID,
    val ticketBoxId: UUID,
    val playerId: UUID,
) : com.prizedraw.application.ports.output.DomainEvent {
    override val eventType: String = "draw.kuji.completed"
    override val aggregateType: String = "DrawTicket"
    override val aggregateId: UUID = ticketBoxId
}
