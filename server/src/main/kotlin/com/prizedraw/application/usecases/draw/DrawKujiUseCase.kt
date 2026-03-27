package com.prizedraw.application.usecases.draw

import com.prizedraw.application.ports.input.draw.IDrawKujiUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.ICouponRepository
import com.prizedraw.application.ports.output.IDrawRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IQueueRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.contracts.dto.draw.DrawResultDto
import com.prizedraw.contracts.dto.draw.DrawnTicketResultDto
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.DrawTicket
import com.prizedraw.domain.entities.PlayerCouponStatus
import com.prizedraw.domain.entities.Queue
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.services.DrawCore
import com.prizedraw.domain.services.KujiDrawDomainService
import com.prizedraw.domain.services.PrizePoolEntry
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
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
    val outboxRepository: IOutboxRepository,
    val auditRepository: IAuditRepository,
    val domainService: KujiDrawDomainService,
    val redisPubSub: RedisPubSub,
    val drawCore: DrawCore,
    val couponRepository: ICouponRepository? = null,
)

/**
 * Executes the full kuji draw transaction.
 *
 * Processing order per draw:
 * 1. Validate session holder via queue.
 * 2. Resolve tickets (explicit IDs or random selection).
 * 3. Apply coupon discount if provided.
 * 4. Delegate to [DrawCore]: weighted selection → balance debit → PrizeInstance creation →
 *    DrawPointTransaction recording → outbox event dispatch → XP award.
 * 5. Mark each ticket DRAWN using the instance ID returned from the core.
 * 6. Decrement [TicketBox.remainingTickets]; mark SOLD_OUT if 0.
 * 7. Insert [AuditLog].
 * 8. Publish WebSocket event on `kuji:{campaignId}`.
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
        val pricePerDraw = getCampaignPrice(box.kujiCampaignId)
        val basePrice = resolvedTickets.size * pricePerDraw
        val (_, discountAmount) = resolveCouponDiscount(playerId, playerCouponId, basePrice)

        val pool = buildPool(resolvedTickets, ticketIds)

        val outcomes =
            newSuspendedTransaction {
                markCouponExhausted(playerId, playerCouponId)
                deps.drawCore.draw(
                    playerId = playerId,
                    pool = pool,
                    quantity = resolvedTickets.size,
                    pricePerDraw = pricePerDraw,
                    discountAmount = discountAmount,
                    gameType = "KUJI",
                    preSelected = pool,
                )
            }

        val results =
            newSuspendedTransaction {
                val now = Clock.System.now()
                val drawnResults =
                    outcomes.map { outcome ->
                        val ticketId =
                            outcome.metadata["ticketId"]?.let { UUID.fromString(it) }
                                ?: error("DrawCore outcome missing ticketId in metadata")
                        val position = outcome.metadata["position"]?.toIntOrNull() ?: 0
                        deps.drawRepository.markDrawn(ticketId, playerId, outcome.prizeInstanceId, now)
                        val prizeDef =
                            deps.prizeRepository.findDefinitionById(
                                PrizeDefinitionId(outcome.prizeDefinitionId),
                            )
                        checkNotNull(prizeDef) { "PrizeDefinition ${outcome.prizeDefinitionId} not found" }
                        DrawnTicketResultDto(
                            ticketId = ticketId.toString(),
                            position = position,
                            prizeInstanceId = outcome.prizeInstanceId.value.toString(),
                            grade = prizeDef.grade,
                            prizeName = prizeDef.name,
                            prizePhotoUrl = prizeDef.photos.firstOrNull() ?: "",
                            pointsCharged = outcome.pointsCharged,
                            discountApplied = if (outcomes.size == 1) discountAmount else 0,
                        )
                    }
                handleBoxSoldOut(box, resolvedTickets.size)
                recordAuditLog(playerId, box, resolvedTickets.size, basePrice - discountAmount, now)
                drawnResults
            }

        publishDrawEvents(box, results, playerId)
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

    private suspend fun markCouponExhausted(
        playerId: PlayerId,
        playerCouponId: UUID?,
    ) {
        if (playerCouponId == null || deps.couponRepository == null) return
        val pc = deps.couponRepository.findPlayerCouponById(playerCouponId)
        if (pc != null && pc.playerId == playerId) {
            val now = Clock.System.now()
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

    /**
     * Builds a [PrizePoolEntry] list from the resolved tickets.
     *
     * All kuji tickets carry equal weight (1). If the player specified explicit ticket IDs,
     * the pool is filtered to only those entries so DrawCore selects from the same subset.
     */
    private fun buildPool(
        resolvedTickets: List<DrawTicket>,
        requestedTicketIds: List<UUID>,
    ): List<PrizePoolEntry> {
        val ticketSet = if (requestedTicketIds.isNotEmpty()) requestedTicketIds.toSet() else null
        return resolvedTickets
            .filter { ticketSet == null || it.id in ticketSet }
            .map { ticket ->
                PrizePoolEntry(
                    prizeDefinitionId = ticket.prizeDefinitionId.value,
                    weight = 1,
                    metadata =
                        mapOf(
                            "ticketId" to ticket.id.toString(),
                            "position" to ticket.position.toString(),
                        ),
                )
            }
    }

    private suspend fun handleBoxSoldOut(
        box: TicketBox,
        drawnCount: Int,
    ) {
        val now = Clock.System.now()
        val freshBox =
            deps.ticketBoxRepository.findById(box.id)
                ?: error("TicketBox ${box.id} not found during sold-out check")
        val newRemaining = (freshBox.remainingTickets - drawnCount).coerceAtLeast(0)
        val updatedBox =
            if (newRemaining <= 0) {
                freshBox.copy(
                    remainingTickets = 0,
                    status = DomainTicketBoxStatus.SOLD_OUT,
                    soldOutAt = now,
                    updatedAt = now,
                )
            } else {
                freshBox.copy(
                    remainingTickets = newRemaining,
                    updatedAt = now,
                )
            }
        deps.ticketBoxRepository.save(updatedBox)
        if (newRemaining <= 0) {
            checkCampaignSoldOut(freshBox.kujiCampaignId)
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
