package com.prizedraw.application.usecases.draw

import com.prizedraw.application.ports.input.draw.IDrawUnlimitedUseCase
import com.prizedraw.application.ports.output.DomainEvent
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.ICouponRepository
import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.contracts.dto.draw.UnlimitedDrawResultDto
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.DrawPointTransaction
import com.prizedraw.domain.entities.PlayerCouponStatus
import com.prizedraw.domain.entities.PrizeAcquisitionMethod
import com.prizedraw.domain.entities.PrizeInstance
import com.prizedraw.domain.services.UnlimitedDrawDomainService
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import com.prizedraw.infrastructure.external.redis.RedisClient
import io.lettuce.core.Range
import io.lettuce.core.ScoredValue
import kotlinx.coroutines.future.await
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.slf4j.LoggerFactory
import java.util.UUID

/** Thrown when an unlimited campaign is not found or is not in ACTIVE state. */
public class UnlimitedCampaignNotFoundException(
    id: UUID,
) : IllegalArgumentException("UnlimitedCampaign $id not found or inactive")

/** Thrown when a player exceeds the per-second draw rate limit for an unlimited campaign. */
public class UnlimitedRateLimitExceededException(
    playerId: PlayerId,
    campaignId: UUID,
    limit: Int,
) : IllegalStateException(
        "Player ${playerId.value} exceeded rate limit of $limit draws/sec for campaign $campaignId",
    )

/** Maximum retries for the optimistic balance debit. */
private const val MAX_BALANCE_RETRIES = 3

/** Basis points denominator used to convert percentage discount values. */
private const val BPS_DENOMINATOR = 100.0

/** Redis sliding window width in milliseconds (1 second). */
private const val RATE_LIMIT_WINDOW_MS = 1_000L

/**
 * Dependencies for [DrawUnlimitedUseCase], grouped to keep the primary constructor under
 * detekt's parameter-count threshold.
 */
public data class DrawUnlimitedDeps(
    val campaignRepository: ICampaignRepository,
    val prizeRepository: IPrizeRepository,
    val playerRepository: IPlayerRepository,
    val drawPointTxRepository: IDrawPointTransactionRepository,
    val outboxRepository: IOutboxRepository,
    val auditRepository: IAuditRepository,
    val domainService: UnlimitedDrawDomainService,
    val redisClient: RedisClient,
    val couponRepository: ICouponRepository? = null,
)

/**
 * Executes a single probability-based unlimited draw for an authenticated player.
 *
 * Processing order:
 * 1. Resolve the active [UnlimitedCampaign] and its prize definitions (from cache key or DB).
 * 2. Enforce the Redis sliding-window rate limit:
 *    `ZRANGEBYSCORE unlimited:ratelimit:{playerId}:{campaignId} (now-1s) now`
 *    Rejects if the count >= [campaign.rateLimitPerSecond].
 * 3. Record the draw timestamp in the Redis sorted set and expire stale entries atomically.
 * 4. Call [UnlimitedDrawDomainService.spin] to select the winning prize definition.
 * 5. In a single DB transaction:
 *    a. Create a [PrizeInstance] in [PrizeState.HOLDING].
 *    b. Debit draw points with optimistic-lock retry (up to [MAX_BALANCE_RETRIES]).
 *    c. Insert a [DrawPointTransaction] ledger entry.
 *    d. Insert an [AuditLog] entry.
 *    e. Enqueue a [UnlimitedDrawCompletedEvent] into the outbox.
 * 6. Return the [UnlimitedDrawResultDto].
 */
public class DrawUnlimitedUseCase(
    private val deps: DrawUnlimitedDeps,
) : IDrawUnlimitedUseCase {
    private val log = LoggerFactory.getLogger(DrawUnlimitedUseCase::class.java)

    override suspend fun execute(
        playerId: PlayerId,
        campaignId: UUID,
        playerCouponId: UUID?,
    ): UnlimitedDrawResultDto {
        val campaign =
            deps.campaignRepository.findUnlimitedById(CampaignId(campaignId))
                ?: throw UnlimitedCampaignNotFoundException(campaignId)
        val definitions =
            deps.prizeRepository.findDefinitionsByCampaign(
                CampaignId(campaignId),
                CampaignType.UNLIMITED,
            )
        enforceRateLimit(playerId, campaignId, campaign.rateLimitPerSecond)
        val wonDefinition = deps.domainService.spin(definitions)
        val (effectivePrice, discountAmount) =
            resolveCouponDiscount(playerId, playerCouponId, campaign.pricePerDraw)
        return executeDrawTransaction(
            playerId = playerId,
            campaignId = campaignId,
            pricePerDraw = effectivePrice,
            wonDefinition = wonDefinition,
            playerCouponId = playerCouponId,
        )
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

    /**
     * Checks the Redis sliding-window rate limit and records the current draw timestamp.
     *
     * Uses a sorted set keyed `unlimited:ratelimit:{playerId}:{campaignId}` with scores
     * as epoch-millisecond timestamps. Stale entries outside the 1-second window are
     * removed before the count is checked.
     */
    private suspend fun enforceRateLimit(
        playerId: PlayerId,
        campaignId: UUID,
        rateLimitPerSecond: Int,
    ) {
        val key = "unlimited:ratelimit:${playerId.value}:$campaignId"
        val nowMs = Clock.System.now().toEpochMilliseconds()
        val windowStart = (nowMs - RATE_LIMIT_WINDOW_MS).toDouble()
        val nowScore = nowMs.toDouble()

        val count =
            deps.redisClient.withConnection { commands ->
                // Remove entries older than the 1-second window: scores in (-inf, windowStart)
                val staleRange = Range.create(Double.NEGATIVE_INFINITY, windowStart - 1.0)
                commands.zremrangebyscore(key, staleRange).await()
                val recentCount = commands.zcard(key).await()
                if (recentCount >= rateLimitPerSecond) {
                    return@withConnection recentCount
                }
                // Record this draw with a unique member to handle concurrent draws at same ms
                val member = UUID.randomUUID().toString()
                commands.zadd(key, ScoredValue.just(nowScore, member)).await()
                // Keep the key from accumulating forever — expire after 2 seconds
                commands.expire(key, 2L).await()
                recentCount
            }
        if (count >= rateLimitPerSecond) {
            throw UnlimitedRateLimitExceededException(playerId, campaignId, rateLimitPerSecond)
        }
    }

    private suspend fun executeDrawTransaction(
        playerId: PlayerId,
        campaignId: UUID,
        pricePerDraw: Int,
        wonDefinition: com.prizedraw.domain.entities.PrizeDefinition,
        playerCouponId: UUID?,
    ): UnlimitedDrawResultDto =
        newSuspendedTransaction {
            val now = Clock.System.now()
            val player = deps.playerRepository.findById(playerId)
            checkNotNull(player) { "Player ${playerId.value} not found" }
            if (player.drawPointsBalance < pricePerDraw) {
                throw InsufficientPointsException(pricePerDraw, player.drawPointsBalance)
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
            val instanceId = PrizeInstanceId(UUID.randomUUID())
            val instance =
                PrizeInstance(
                    id = instanceId,
                    prizeDefinitionId = wonDefinition.id,
                    ownerId = playerId,
                    acquisitionMethod = PrizeAcquisitionMethod.UNLIMITED_DRAW,
                    sourceDrawTicketId = null,
                    sourceTradeOrderId = null,
                    sourceExchangeRequestId = null,
                    state = PrizeState.HOLDING,
                    acquiredAt = now,
                    deletedAt = null,
                    createdAt = now,
                    updatedAt = now,
                )
            deps.prizeRepository.saveInstance(instance)
            debitBalanceWithRetry(playerId, pricePerDraw, now)
            recordAuditAndOutbox(playerId, campaignId, instanceId, pricePerDraw, now)
            UnlimitedDrawResultDto(
                prizeInstanceId = instanceId.value.toString(),
                grade = wonDefinition.grade,
                prizeName = wonDefinition.name,
                prizePhotoUrl = wonDefinition.photos.firstOrNull() ?: "",
                pointsCharged = pricePerDraw,
            )
        }

    private suspend fun debitBalanceWithRetry(
        playerId: PlayerId,
        cost: Int,
        now: kotlinx.datetime.Instant,
    ) {
        repeat(MAX_BALANCE_RETRIES) { attempt ->
            val player = deps.playerRepository.findById(playerId)
            checkNotNull(player) { "Player ${playerId.value} not found" }
            val newBalance = player.drawPointsBalance - cost
            if (newBalance < 0) {
                throw InsufficientPointsException(cost, player.drawPointsBalance)
            }
            val updated =
                deps.playerRepository.updateBalance(
                    id = playerId,
                    drawPointsDelta = -cost,
                    revenuePointsDelta = 0,
                    expectedVersion = player.version,
                )
            if (updated) {
                deps.drawPointTxRepository.record(
                    DrawPointTransaction(
                        id = UUID.randomUUID(),
                        playerId = playerId,
                        type = DrawPointTxType.UNLIMITED_DRAW_DEBIT,
                        amount = -cost,
                        balanceAfter = newBalance,
                        paymentOrderId = null,
                        description = "Unlimited draw debit",
                        createdAt = now,
                    ),
                )
                return
            }
            log.warn("Balance optimistic lock failed for player ${playerId.value}, attempt ${attempt + 1}")
        }
        error("Failed to debit balance for player ${playerId.value} after $MAX_BALANCE_RETRIES attempts")
    }

    private fun recordAuditAndOutbox(
        playerId: PlayerId,
        campaignId: UUID,
        instanceId: PrizeInstanceId,
        cost: Int,
        now: kotlinx.datetime.Instant,
    ) {
        val metadata =
            buildJsonObject {
                put("campaignId", campaignId.toString())
                put("prizeInstanceId", instanceId.value.toString())
                put("cost", cost)
            }
        deps.auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.PLAYER,
                actorPlayerId = playerId,
                actorStaffId = null,
                action = "unlimited.draw",
                entityType = "UnlimitedCampaign",
                entityId = campaignId,
                beforeValue = null,
                afterValue = null,
                metadata = metadata,
                createdAt = now,
            ),
        )
        deps.outboxRepository.enqueue(
            UnlimitedDrawCompletedEvent(
                campaignId = campaignId,
                prizeInstanceId = instanceId.value,
                playerId = playerId.value,
            ),
        )
    }
}

/** Outbox domain event emitted after a successful unlimited draw. */
internal class UnlimitedDrawCompletedEvent(
    val campaignId: UUID,
    val prizeInstanceId: UUID,
    val playerId: UUID,
) : DomainEvent {
    override val eventType: String = "draw.unlimited.completed"
    override val aggregateType: String = "PrizeInstance"
    override val aggregateId: UUID = prizeInstanceId
}
