@file:Suppress("LongMethod", "BracesOnIfStatements")

package com.prizedraw.draw.application.usecases

import com.prizedraw.contracts.dto.draw.UnlimitedDrawResultDto
import com.prizedraw.contracts.dto.pity.PityProgressDto
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.draw.application.events.FollowingDrawStarted
import com.prizedraw.draw.application.events.FollowingRarePrizeDrawn
import com.prizedraw.draw.application.ports.input.IDrawUnlimitedUseCase
import com.prizedraw.draw.application.ports.output.DomainEvent
import com.prizedraw.draw.application.ports.output.IAuditRepository
import com.prizedraw.draw.application.ports.output.ICampaignRepository
import com.prizedraw.draw.application.ports.output.ICouponRepository
import com.prizedraw.draw.application.ports.output.IOutboxRepository
import com.prizedraw.draw.application.ports.output.IPityRepository
import com.prizedraw.draw.application.ports.output.IPlayerRepository
import com.prizedraw.draw.application.ports.output.IPrizeRepository
import com.prizedraw.draw.application.services.FeedService
import com.prizedraw.draw.domain.entities.AccumulationMode
import com.prizedraw.draw.domain.entities.AuditActorType
import com.prizedraw.draw.domain.entities.AuditLog
import com.prizedraw.draw.domain.entities.CouponDiscountType
import com.prizedraw.draw.domain.entities.PityTracker
import com.prizedraw.draw.domain.entities.PlayerCouponStatus
import com.prizedraw.draw.domain.services.DrawCore
import com.prizedraw.draw.domain.services.DrawOutcome
import com.prizedraw.draw.domain.services.DrawValidationException
import com.prizedraw.draw.domain.services.PityDomainService
import com.prizedraw.draw.domain.services.PityResult
import com.prizedraw.draw.domain.services.PrizePoolEntry
import com.prizedraw.draw.domain.services.UnlimitedDrawDomainService
import com.prizedraw.draw.domain.valueobjects.CampaignId
import com.prizedraw.draw.domain.valueobjects.PlayerId
import com.prizedraw.draw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.draw.infrastructure.redis.RedisClient
import io.lettuce.core.Range
import io.lettuce.core.ScoredValue
import kotlinx.coroutines.delay
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

/** Maximum retry attempts for pity tracker persistence with optimistic locking. */
private const val PITY_TRACKER_MAX_RETRIES = 3

/** Base delay in milliseconds for exponential backoff on pity tracker version conflicts. */
private const val PITY_TRACKER_BASE_DELAY_MS = 50L

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
    val pityRepository: IPityRepository? = null,
    val pityDomainService: PityDomainService? = null,
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
    @Suppress("UnusedPrivateProperty")
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

        val pityCheck = checkPity(playerId, CampaignId(campaignId))
        val pityState = resolvePityPool(pityCheck, definitions)

        val outcome = executeDraw(playerId, playerCouponId, pityCheck, pityState, effectivePrice, discountAmount)

        val result =
            newSuspendedTransaction {
                val prizeDef =
                    deps.prizeRepository.findDefinitionById(PrizeDefinitionId(outcome.prizeDefinitionId))
                checkNotNull(prizeDef) { "PrizeDefinition ${outcome.prizeDefinitionId} not found" }
                recordAuditAndOutbox(playerId, campaignId, outcome.prizeInstanceId.value, effectivePrice)
                emitFollowEvents(playerId, campaign, prizeDef)
                UnlimitedDrawResultDto(
                    prizeInstanceId = outcome.prizeInstanceId.value.toString(),
                    grade = prizeDef.grade,
                    prizeName = prizeDef.name,
                    prizePhotoUrl = prizeDef.photos.firstOrNull() ?: "",
                    pointsCharged = outcome.pointsCharged,
                    pityProgress = buildPityProgress(pityCheck, pityState),
                )
            }

        publishFeedEvent(campaign, result, playerId, pityState.triggered)
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
                CouponDiscountType.PERCENTAGE -> {
                    val factor = (BPS_DENOMINATOR - coupon.discountValue) / BPS_DENOMINATOR
                    (basePrice * factor).toLong().toInt().coerceAtLeast(0)
                }
                CouponDiscountType.FIXED_POINTS ->
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
                val staleRange = Range.create(Double.NEGATIVE_INFINITY, windowStart - 1.0)
                commands.zremrangebyscore(key, staleRange).await()
                val recentCount = commands.zcard(key).await()
                if (recentCount >= rateLimitPerSecond) {
                    return@withConnection recentCount
                }
                val member = UUID.randomUUID().toString()
                commands.zadd(key, ScoredValue.just(nowScore, member)).await()
                commands.expire(key, 2L).await()
                recentCount
            }
        if (count >= rateLimitPerSecond) {
            throw UnlimitedRateLimitExceededException(playerId, campaignId, rateLimitPerSecond)
        }
    }

    /** Resolved pity state for the current draw. */
    private data class PityState(
        val pool: List<PrizePoolEntry>,
        val triggered: Boolean,
        val newDrawCount: Int,
        val threshold: Int,
        val mode: String,
    )

    /** Resolves the prize pool (pity-overridden or normal) and captures pity metadata. */
    private fun resolvePityPool(
        pityCheck: Pair<PityResult, com.prizedraw.draw.domain.entities.PityRule>?,
        definitions: List<com.prizedraw.draw.domain.entities.PrizeDefinition>,
    ): PityState {
        if (pityCheck == null) return PityState(buildNormalPool(definitions), false, 0, 0, "")
        val (pityResult, rule) = pityCheck
        return when (pityResult) {
            is PityResult.Triggered ->
                PityState(
                    pool = listOf(PrizePoolEntry(pityResult.selectedPrizeDefinitionId.value, 1)),
                    triggered = true,
                    newDrawCount = 0,
                    threshold = rule.threshold,
                    mode = rule.accumulationMode.name,
                )
            is PityResult.NotTriggered ->
                PityState(
                    pool = buildNormalPool(definitions),
                    triggered = false,
                    newDrawCount = pityResult.newDrawCount,
                    threshold = rule.threshold,
                    mode = rule.accumulationMode.name,
                )
        }
    }

    /** Executes the draw transaction, persisting the coupon atomically. */
    @Suppress("LongParameterList")
    private suspend fun executeDraw(
        playerId: PlayerId,
        playerCouponId: UUID?,
        pityCheck: Pair<PityResult, com.prizedraw.draw.domain.entities.PityRule>?,
        pityState: PityState,
        effectivePrice: Int,
        discountAmount: Int,
    ): DrawOutcome {
        val outcome =
            newSuspendedTransaction {
                markCouponExhausted(playerId, playerCouponId)
                val drawResult =
                    deps.drawCore.draw(
                        playerId = playerId,
                        pool = pityState.pool,
                        quantity = 1,
                        pricePerDraw = effectivePrice,
                        discountAmount = discountAmount,
                        gameType = "UNLIMITED",
                    )
                drawResult.first()
            }
        if (pityCheck != null) {
            persistPityTracker(pityCheck.second.id, playerId, pityState.newDrawCount)
        }
        return outcome
    }

    /** Builds a [PityProgressDto] from pity check and state, or null if pity is inactive. */
    private fun buildPityProgress(
        pityCheck: Pair<PityResult, com.prizedraw.draw.domain.entities.PityRule>?,
        pityState: PityState,
    ): PityProgressDto? {
        if (pityCheck == null) return null
        val rule = pityCheck.second
        val expiresAt =
            if (rule.accumulationMode == AccumulationMode.SESSION && rule.sessionTimeoutSeconds != null) {
                Clock.System
                    .now()
                    .plus(kotlin.time.Duration.parse("${rule.sessionTimeoutSeconds}s"))
                    .toString()
            } else {
                null
            }
        return PityProgressDto(
            drawCount = pityState.newDrawCount,
            threshold = pityState.threshold,
            isPityTriggered = pityState.triggered,
            mode = pityState.mode,
            sessionExpiresAt = expiresAt,
        )
    }

    /**
     * Checks the pity system and returns a [PityResult] paired with the [PityRule]
     * if a pity rule is configured and enabled for this campaign, or null if no pity applies.
     */
    private suspend fun checkPity(
        playerId: PlayerId,
        campaignId: CampaignId,
    ): Pair<PityResult, com.prizedraw.draw.domain.entities.PityRule>? {
        val repo = deps.pityRepository ?: return null
        val service = deps.pityDomainService ?: return null

        val rule = repo.findRuleByCampaignId(campaignId)
        if (rule == null || !rule.enabled) return null

        val pool = repo.findPoolByRuleId(rule.id)
        val tracker = repo.findTracker(rule.id, playerId)
        val now = Clock.System.now()

        val result = service.evaluate(rule, tracker, pool, now)
        return Pair(result, rule)
    }

    /**
     * Persists the updated pity tracker state after a draw with optimistic locking retry.
     *
     * Each retry attempt opens its own transaction so it reads the latest committed row
     * rather than a stale snapshot from a surrounding transaction.
     * Creates a new tracker if none exists, or updates the existing one.
     * Retries up to [PITY_TRACKER_MAX_RETRIES] times with exponential backoff
     * on version conflicts.
     */
    private suspend fun persistPityTracker(
        pityRuleId: UUID,
        playerId: PlayerId,
        newDrawCount: Int,
    ) {
        val repo = deps.pityRepository ?: return
        val now = Clock.System.now()

        repeat(PITY_TRACKER_MAX_RETRIES) { attempt ->
            val success =
                newSuspendedTransaction {
                    val existing = repo.findTracker(pityRuleId, playerId)
                    val tracker =
                        existing?.copy(drawCount = newDrawCount, lastDrawAt = now, updatedAt = now)
                            ?: PityTracker(
                                id = UUID.randomUUID(),
                                pityRuleId = pityRuleId,
                                playerId = playerId,
                                drawCount = newDrawCount,
                                lastDrawAt = now,
                                version = 0,
                                createdAt = now,
                                updatedAt = now,
                            )
                    repo.saveTracker(tracker)
                }
            if (success) return
            if (attempt < PITY_TRACKER_MAX_RETRIES - 1) {
                delay(PITY_TRACKER_BASE_DELAY_MS * (1L shl attempt))
            }
        }
        log.warn("Pity tracker update failed after $PITY_TRACKER_MAX_RETRIES retries")
    }

    /**
     * Builds the normal (non-pity) prize pool from prize definitions.
     *
     * Validates that the probability sum equals 1,000,000 bps before returning the pool.
     */
    private fun buildNormalPool(
        definitions: List<com.prizedraw.draw.domain.entities.PrizeDefinition>,
    ): List<PrizePoolEntry> {
        if (!deps.domainService.validateProbabilitySum(definitions)) {
            throw DrawValidationException(
                "Probability sum is ${definitions.sumOf { it.probabilityBps ?: 0 }} bps; must equal 1000000",
            )
        }
        return definitions.map { def ->
            PrizePoolEntry(prizeDefinitionId = def.id.value, weight = def.probabilityBps ?: 0)
        }
    }

    /**
     * Emits follow-related domain events into the outbox within the current transaction.
     *
     * Always emits [FollowingDrawStarted]. Additionally emits [FollowingRarePrizeDrawn]
     * if the drawn prize definition is marked as rare.
     */
    private suspend fun emitFollowEvents(
        playerId: PlayerId,
        campaign: com.prizedraw.draw.domain.entities.UnlimitedCampaign,
        prizeDef: com.prizedraw.draw.domain.entities.PrizeDefinition,
    ) {
        val player = deps.playerRepository.findById(playerId) ?: return
        val nickname = player.nickname

        deps.outboxRepository.enqueue(
            FollowingDrawStarted(
                playerId = playerId.value,
                playerNickname = nickname,
                campaignId = campaign.id.value,
                campaignName = campaign.title,
            ),
        )

        if (prizeDef.isRare) {
            deps.outboxRepository.enqueue(
                FollowingRarePrizeDrawn(
                    playerId = playerId.value,
                    playerNickname = nickname,
                    campaignId = campaign.id.value,
                    campaignName = campaign.title,
                    prizeName = prizeDef.name,
                    prizeGrade = prizeDef.grade,
                ),
            )
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
        campaign: com.prizedraw.draw.domain.entities.UnlimitedCampaign,
        result: UnlimitedDrawResultDto,
        playerId: PlayerId,
        pityTriggered: Boolean = false,
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
            pityTriggered = pityTriggered,
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
