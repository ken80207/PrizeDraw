package com.prizedraw.inventory

import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.usecases.draw.DrawUnlimitedDeps
import com.prizedraw.application.usecases.draw.DrawUnlimitedUseCase
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.UnlimitedCampaign
import com.prizedraw.domain.services.DrawValidationException
import com.prizedraw.domain.services.UnlimitedDrawDomainService
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.infrastructure.external.redis.RedisClient
import com.prizedraw.testutil.TransactionTestHelper
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import kotlinx.datetime.Clock
import java.util.UUID
import java.util.concurrent.atomic.AtomicInteger

/**
 * Integrity tests for the unlimited draw campaign type.
 *
 * Unlimited draws have no ticket pool — they draw from a probability table that must
 * sum to exactly 1,000,000 basis points.  These tests verify:
 *
 * 1. A misconfigured probability sum (≠ 1,000,000 bps) is rejected at draw time.
 * 2. The empirical distribution from 10,000 draws stays within ±2% of configured probabilities.
 * 3. A zero-probability prize is never awarded in 10,000 draws.
 * 4. Unlimited draws never become "sold out" — the 1,000th draw succeeds the same as the 1st.
 *
 * The Redis rate-limiter is stubbed to always allow draws so these tests focus exclusively
 * on the probability invariants rather than rate-limiting (which is covered in
 * [com.prizedraw.concurrency.DrawConcurrencyTest]).
 */
class UnlimitedDrawIntegrityTest : DescribeSpec({

    val now = Clock.System.now()

    // -------------------------------------------------------------------------
    // Domain fixture helpers
    // -------------------------------------------------------------------------

    fun makePlayer(balance: Int = 1_000_000): Player =
        Player(
            id = PlayerId.generate(),
            nickname = "Tester",
            avatarUrl = null,
            phoneNumber = null,
            phoneVerifiedAt = null,
            oauthProvider = OAuthProvider.GOOGLE,
            oauthSubject = "sub-${UUID.randomUUID()}",
            drawPointsBalance = balance,
            revenuePointsBalance = 0,
            version = 0,
            preferredAnimationMode = DrawAnimationMode.TEAR,
            locale = "zh-TW",
            isActive = true,
            deletedAt = null,
            createdAt = now,
            updatedAt = now,
        )

    fun makeCampaign(id: UUID = UUID.randomUUID()): UnlimitedCampaign =
        UnlimitedCampaign(
            id = CampaignId(id),
            title = "Unlimited Integrity Test",
            description = null,
            coverImageUrl = null,
            pricePerDraw = 1,
            rateLimitPerSecond = Int.MAX_VALUE, // Effectively unlimited for probability tests
            status = CampaignStatus.ACTIVE,
            activatedAt = now,
            createdByStaffId = UUID.randomUUID(),
            deletedAt = null,
            createdAt = now,
            updatedAt = now,
        )

    fun makeDef(
        campaignId: UUID,
        grade: String,
        probabilityBps: Int,
    ): PrizeDefinition =
        PrizeDefinition(
            id = PrizeDefinitionId.generate(),
            kujiCampaignId = null,
            unlimitedCampaignId = CampaignId(campaignId),
            grade = grade,
            name = "Prize $grade",
            photos = emptyList(),
            buybackPrice = 0,
            buybackEnabled = false,
            probabilityBps = probabilityBps,
            ticketCount = null,
            displayOrder = 0,
            createdAt = now,
            updatedAt = now,
        )

    /**
     * Builds a [DrawUnlimitedUseCase] with a Redis stub that always permits draws
     * (window count returned = 0, below any rate limit).
     */
    fun buildUseCase(
        campaign: UnlimitedCampaign,
        definitions: List<PrizeDefinition>,
        player: Player,
    ): DrawUnlimitedUseCase {
        val campaignRepo = mockk<ICampaignRepository>()
        val prizeRepo = mockk<IPrizeRepository>()
        val playerRepo = mockk<IPlayerRepository>()
        val drawPointTxRepo = mockk<IDrawPointTransactionRepository>()
        val outboxRepo = mockk<IOutboxRepository>()
        val auditRepo = mockk<IAuditRepository>()
        val redisClient = mockk<RedisClient>()

        coEvery { campaignRepo.findUnlimitedById(campaign.id) } returns campaign
        coEvery { prizeRepo.findDefinitionsByCampaign(campaign.id, any()) } returns definitions
        coEvery { playerRepo.findById(player.id) } returns player
        coEvery { playerRepo.updateBalance(any(), any(), any(), any()) } returns true
        coEvery { prizeRepo.saveInstance(any()) } coAnswers { firstArg() }
        every { drawPointTxRepo.record(any()) } just runs
        every { auditRepo.record(any()) } just runs
        every { outboxRepo.enqueue(any()) } just runs

        // Redis stub: always returns count=0 (window is empty → draw is allowed)
        coEvery { redisClient.withConnection<Long>(any()) } returns 0L

        return DrawUnlimitedUseCase(
            DrawUnlimitedDeps(
                campaignRepository = campaignRepo,
                prizeRepository = prizeRepo,
                playerRepository = playerRepo,
                drawPointTxRepository = drawPointTxRepo,
                outboxRepository = outboxRepo,
                auditRepository = auditRepo,
                domainService = UnlimitedDrawDomainService(),
                redisClient = redisClient,
            ),
        )
    }

    // -------------------------------------------------------------------------
    // Transaction mocking
    // -------------------------------------------------------------------------

    beforeSpec { TransactionTestHelper.mockTransactions() }
    afterSpec { TransactionTestHelper.unmockTransactions() }
    beforeEach { TransactionTestHelper.stubTransaction() }
    afterEach { clearAllMocks(); TransactionTestHelper.stubTransaction() }

    // =========================================================================
    // Probability sum validation
    // =========================================================================

    describe("Unlimited draw probability integrity") {

        it("probability sum must equal 1,000,000 bps — rejects misconfigured campaign") {
            // A=5000, B=30000, C=164999 → sum = 199,999 (not 1,000,000)
            val campaignId = UUID.randomUUID()
            val campaign = makeCampaign(campaignId)
            val player = makePlayer()
            val definitions = listOf(
                makeDef(campaignId, "A", 5_000),
                makeDef(campaignId, "B", 30_000),
                makeDef(campaignId, "C", 164_999),
            )

            val useCase = buildUseCase(campaign, definitions, player)

            // spin() inside the use case must throw DrawValidationException for bad probability sum
            shouldThrow<DrawValidationException> {
                useCase.execute(player.id, campaignId, null)
            }
        }

        it("10,000 draws produce distribution within ±2% of configured probability") {
            // A=0.5% (5000 bps), B=3% (30000), C=16.5% (165000), D=80% (800000)
            val campaignId = UUID.randomUUID()
            val campaign = makeCampaign(campaignId)
            val player = makePlayer(balance = Int.MAX_VALUE)

            val defA = makeDef(campaignId, "A", 5_000)
            val defB = makeDef(campaignId, "B", 30_000)
            val defC = makeDef(campaignId, "C", 165_000)
            val defD = makeDef(campaignId, "D", 800_000)
            val definitions = listOf(defA, defB, defC, defD)

            // Verify the test's own setup is valid
            val sum = definitions.sumOf { it.probabilityBps ?: 0 }
            sum shouldBe 1_000_000

            val useCase = buildUseCase(campaign, definitions, player)

            val gradeCounts = mutableMapOf("A" to 0, "B" to 0, "C" to 0, "D" to 0)
            val totalDraws = 10_000

            repeat(totalDraws) {
                val result = useCase.execute(player.id, campaignId, null)
                gradeCounts[result.grade] = (gradeCounts[result.grade] ?: 0) + 1
            }

            // Each grade must be within ±2% absolute of its configured probability
            val rateA = gradeCounts["A"]!!.toDouble() / totalDraws
            val rateB = gradeCounts["B"]!!.toDouble() / totalDraws
            val rateC = gradeCounts["C"]!!.toDouble() / totalDraws
            val rateD = gradeCounts["D"]!!.toDouble() / totalDraws

            rateA shouldBe (0.005 plusOrMinus 0.02)
            rateB shouldBe (0.030 plusOrMinus 0.02)
            rateC shouldBe (0.165 plusOrMinus 0.02)
            rateD shouldBe (0.800 plusOrMinus 0.02)
        }

        it("zero-probability prize is never drawn in 10,000 attempts") {
            // A=0 bps, B=500000, C=500000  (A has 0% chance — must never appear)
            val campaignId = UUID.randomUUID()
            val campaign = makeCampaign(campaignId)
            val player = makePlayer(balance = Int.MAX_VALUE)

            val defA = makeDef(campaignId, "A", 0)
            val defB = makeDef(campaignId, "B", 500_000)
            val defC = makeDef(campaignId, "C", 500_000)
            val definitions = listOf(defA, defB, defC)

            val useCase = buildUseCase(campaign, definitions, player)

            val aCount = AtomicInteger(0)
            repeat(10_000) {
                val result = useCase.execute(player.id, campaignId, null)
                if (result.grade == "A") aCount.incrementAndGet()
            }

            // A must never be awarded
            aCount.get() shouldBe 0
        }

        it("unlimited draws do not deplete — 1,000th draw works same as 1st") {
            // There is no sold-out concept for unlimited campaigns.
            // All 1,000 draws must succeed without any "inventory exhausted" error.
            val campaignId = UUID.randomUUID()
            val campaign = makeCampaign(campaignId)
            val player = makePlayer(balance = Int.MAX_VALUE)

            val definitions = listOf(
                makeDef(campaignId, "A", 200_000),
                makeDef(campaignId, "B", 800_000),
            )

            val useCase = buildUseCase(campaign, definitions, player)

            var lastResult: com.prizedraw.contracts.dto.draw.UnlimitedDrawResultDto? = null
            repeat(1_000) {
                // Must not throw — no sold-out exception, no inventory error
                lastResult = useCase.execute(player.id, campaignId, null)
            }

            // The 1,000th draw must have returned a valid result
            val finalResult = lastResult
            checkNotNull(finalResult) { "Expected a result from the 1000th draw" }
            // Grade must be one of the configured options
            listOf("A", "B").contains(finalResult.grade) shouldBe true
        }
    }
})
