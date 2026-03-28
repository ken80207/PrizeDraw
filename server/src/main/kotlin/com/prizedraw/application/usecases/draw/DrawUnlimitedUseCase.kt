package com.prizedraw.application.usecases.draw

import com.prizedraw.application.ports.input.draw.IDrawUnlimitedUseCase
import com.prizedraw.application.ports.output.DomainEvent
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.ICouponRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.services.FeedService
import com.prizedraw.contracts.dto.draw.UnlimitedDrawResultDto
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.PlayerCouponStatus
import com.prizedraw.domain.services.DrawCore
import com.prizedraw.domain.services.DrawValidationException
import com.prizedraw.domain.services.PrizePoolEntry
import com.prizedraw.domain.services.UnlimitedDrawDomainService
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
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
    val outboxRepository: IOutboxRepository,
    val auditRepository: IAuditRepository,
    val domainService: UnlimitedDrawDomainService,
    val redisClient: RedisClient,
    val drawCore: DrawCore,
    val couponRepository: ICouponRepository? = null,
    val feedService: FeedService,
    val playerRepository: IPlayerRepository,
)

/**
 * Executes a single probability-based unlimited draw for an authenticated player.
 *
 * Processing order:
 * 1. Resolve the active [UnlimitedCampaign] and its prize definitions.
 * 2. Enforce the Redis sliding-window rate limit.
 * 3. Record the draw timestamp in the Redis sorted set and expire stale entries atomically.
 * 4. Apply coupon discount if provided.
 * 5. Build a [PrizePoolEntry] list from prize definitions using [probabilityBps] as weight.
 * 6. Delegate to [DrawCore]: weighted selection → balance debit → PrizeInstance creation →
 *    DrawPointTransaction recording → outbox event dispatch → XP award.
 * 7. Record [AuditLog] and enqueue [UnlimitedDrawCompletedEvent].
 * 8. Return the [UnlimitedDrawResultDto].
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
        val (effectivePrice, discountAmount) =
            resolveCouponDiscount(playerId, playerCouponId, campaign.pricePerDraw)

        // Validate probability distribution before drawing
        if (!deps.domainService.validateProbabilitySum(definitions)) {
            throw DrawValidationException(
                "Probability sum is ${definitions.sumOf { it.probabilityBps ?: 0 }} bps; must equal 1000000",
            )
        }

        val pool =
            definitions.map { def ->
                PrizePoolEntry(
                    prizeDefinitionId = def.id.value,
                    weight = def.probabilityBps ?: 0,
                )
            }

        val result =
            newSuspendedTransaction {
                markCouponExhausted(playerId, playerCouponId)
                val drawResult =
                    deps.drawCore.draw(
                        playerId = playerId,
                        pool = pool,
                        quantity = 1,
                        pricePerDraw = effectivePrice,
                        discountAmount = discountAmount,
                        gameType = "UNLIMITED",
                    )

                val outcome = drawResult.first()
                val prizeDef =
                    deps.prizeRepository.findDefinitionById(PrizeDefinitionId(outcome.prizeDefinitionId))
                checkNotNull(prizeDef) { "PrizeDefinition ${outcome.prizeDefinitionId} not found" }

                recordAuditAndOutbox(playerId, campaignId, outcome.prizeInstanceId.value, effectivePrice)

                UnlimitedDrawResultDto(
                    prizeInstanceId = outcome.prizeInstanceId.value.toString(),
                    grade = prizeDef.grade,
                    prizeName = prizeDef.name,
                    prizePhotoUrl = prizeDef.photos.firstOrNull() ?: "",
                    pointsCharged = outcome.pointsCharged,
                )
            }

        publishFeedEvent(campaign, result, playerId)
        return result
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

    private fun recordAuditAndOutbox(
        playerId: PlayerId,
        campaignId: UUID,
        instanceId: UUID,
        cost: Int,
    ) {
        val now = Clock.System.now()
        val metadata =
            buildJsonObject {
                put("campaignId", campaignId.toString())
                put("prizeInstanceId", instanceId.toString())
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
                prizeInstanceId = instanceId,
                playerId = playerId.value,
            ),
        )
    }

    private suspend fun publishFeedEvent(
        campaign: com.prizedraw.domain.entities.UnlimitedCampaign,
        result: UnlimitedDrawResultDto,
        playerId: PlayerId,
    ) {
        val player = deps.playerRepository.findById(playerId)
        deps.feedService.publishDrawEvent(
            drawId = result.prizeInstanceId,
            playerId = playerId.value.toString(),
            playerNickname = player?.nickname ?: "Player",
            playerAvatarUrl = player?.avatarUrl,
            campaignId = campaign.id.value.toString(),
            campaignTitle = campaign.title,
            campaignType = CampaignType.UNLIMITED,
            prizeGrade = result.grade,
            prizeName = result.prizeName,
            prizePhotoUrl = result.prizePhotoUrl,
            drawnAt = Clock.System.now(),
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
