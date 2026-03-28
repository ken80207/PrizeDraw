package com.prizedraw.integration

import com.prizedraw.application.ports.output.IPityRepository
import com.prizedraw.domain.entities.AccumulationMode
import com.prizedraw.domain.entities.PityPrizePoolEntry
import com.prizedraw.domain.entities.PityRule
import com.prizedraw.domain.entities.PityTracker
import com.prizedraw.domain.services.PityDomainService
import com.prizedraw.domain.services.PityResult
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

/**
 * Integration tests for the pity (guaranteed-drop) system end-to-end flow.
 *
 * Tests the full pity loop: [PityDomainService] evaluation → tracker state persistence
 * → re-evaluation on the next draw. All repository interactions are handled by an
 * in-memory fake that mirrors the real Postgres implementation's behaviour without
 * requiring a live database.
 *
 * Scenarios:
 * 1. Pity triggers at threshold — Nth draw returns Triggered + isPityTriggered == true.
 * 2. Counter resets after trigger — after pity fires, next draw count restarts from 1.
 * 3. SESSION mode timeout — draws past session timeout cause counter to reset.
 * 4. No pity rule — campaigns without a rule return pityProgress == null.
 * 5. Disabled rule — rule exists but enabled = false; normal draw behaviour is unaffected.
 */
class PityDrawIntegrationTest :
    DescribeSpec({

        // -------------------------------------------------------------------------
        // In-memory fake IPityRepository
        // -------------------------------------------------------------------------

        /**
         * Thread-safe in-memory fake for [IPityRepository].
         *
         * Mirrors optimistic-locking behaviour of the real repository: [saveTracker]
         * checks the version field and returns false when a stale version is supplied.
         */
        class FakePityRepository : IPityRepository {
            private val rules = ConcurrentHashMap<UUID, PityRule>()
            private val pools = ConcurrentHashMap<UUID, List<PityPrizePoolEntry>>()
            private val trackers = ConcurrentHashMap<String, PityTracker>()

            private fun trackerKey(ruleId: UUID, playerId: PlayerId) =
                "${ruleId}:${playerId.value}"

            override suspend fun findRuleByCampaignId(campaignId: CampaignId): PityRule? =
                rules.values.find { it.campaignId == campaignId }

            override suspend fun findRuleById(ruleId: UUID): PityRule? = rules[ruleId]

            override suspend fun saveRule(rule: PityRule): PityRule {
                rules[rule.id] = rule
                return rule
            }

            override suspend fun deleteRule(ruleId: UUID) {
                rules.remove(ruleId)
                pools.remove(ruleId)
                trackers.keys.removeIf { it.startsWith("$ruleId:") }
            }

            override suspend fun findPoolByRuleId(ruleId: UUID): List<PityPrizePoolEntry> =
                pools[ruleId] ?: emptyList()

            override suspend fun replacePool(
                ruleId: UUID,
                entries: List<PityPrizePoolEntry>,
            ) {
                pools[ruleId] = entries.toList()
            }

            override suspend fun findTracker(
                ruleId: UUID,
                playerId: PlayerId,
            ): PityTracker? = trackers[trackerKey(ruleId, playerId)]

            override suspend fun saveTracker(tracker: PityTracker): Boolean {
                val key = trackerKey(tracker.pityRuleId, tracker.playerId)
                val existing = trackers[key]
                // Optimistic locking: if an existing row is present, its version must match.
                return if (existing != null && existing.version != tracker.version) {
                    false
                } else {
                    trackers[key] = tracker.copy(version = tracker.version + 1)
                    true
                }
            }
        }

        // -------------------------------------------------------------------------
        // Helpers to simulate the pity orchestration used inside DrawUnlimitedUseCase
        // -------------------------------------------------------------------------

        /**
         * Performs a single simulated draw step against the pity system.
         *
         * Mirrors the [checkPity] + [persistPityTracker] logic from
         * [DrawUnlimitedUseCase] without any database transactions or Redis overhead.
         *
         * @param repo     The in-memory repository backing the pity state.
         * @param service  The domain service that evaluates pity logic.
         * @param campaignId The campaign being drawn.
         * @param playerId   The player performing the draw.
         * @param now      Current timestamp (injectable so tests can control time).
         * @return A [PityResult] if a pity rule is active, or null if no rule applies.
         */
        suspend fun simulatePityDraw(
            repo: FakePityRepository,
            service: PityDomainService,
            campaignId: CampaignId,
            playerId: PlayerId,
            now: Instant = Clock.System.now(),
        ): PityResult? {
            val rule = repo.findRuleByCampaignId(campaignId) ?: return null
            if (!rule.enabled) return null

            val pool = repo.findPoolByRuleId(rule.id)
            val tracker = repo.findTracker(rule.id, playerId)
            val result = service.evaluate(rule, tracker, pool, now)

            // Persist updated tracker (mirrors DrawUnlimitedUseCase.persistPityTracker)
            val existing = repo.findTracker(rule.id, playerId)
            val updatedTracker =
                existing?.copy(drawCount = result.newDrawCount, lastDrawAt = now, updatedAt = now)
                    ?: PityTracker(
                        id = UUID.randomUUID(),
                        pityRuleId = rule.id,
                        playerId = playerId,
                        drawCount = result.newDrawCount,
                        lastDrawAt = now,
                        version = 0,
                        createdAt = now,
                        updatedAt = now,
                    )
            repo.saveTracker(updatedTracker)

            return result
        }

        // -------------------------------------------------------------------------
        // Fixture builders
        // -------------------------------------------------------------------------

        val now = Clock.System.now()
        val service = PityDomainService()

        fun makeRule(
            campaignId: CampaignId,
            threshold: Int = 5,
            mode: AccumulationMode = AccumulationMode.PERSISTENT,
            sessionTimeout: Int? = null,
            enabled: Boolean = true,
        ): PityRule =
            PityRule(
                id = UUID.randomUUID(),
                campaignId = campaignId,
                campaignType = "UNLIMITED",
                threshold = threshold,
                accumulationMode = mode,
                sessionTimeoutSeconds = sessionTimeout,
                enabled = enabled,
                createdAt = now,
                updatedAt = now,
            )

        fun makePoolEntry(
            ruleId: UUID,
            prizeId: PrizeDefinitionId = PrizeDefinitionId.generate(),
        ): PityPrizePoolEntry =
            PityPrizePoolEntry(
                id = UUID.randomUUID(),
                pityRuleId = ruleId,
                prizeDefinitionId = prizeId,
                weight = 100,
            )

        // =========================================================================
        // Scenario 1 — Pity triggers at threshold
        // =========================================================================

        describe("Pity triggers at threshold") {
            it(
                "the Nth draw (threshold=5) returns Triggered and isPityTriggered == true",
            ) {
                val repo = FakePityRepository()
                val campaignId = CampaignId.generate()
                val playerId = PlayerId.generate()
                val rule = makeRule(campaignId, threshold = 5)
                val prizeId = PrizeDefinitionId.generate()

                repo.saveRule(rule)
                repo.replacePool(rule.id, listOf(makePoolEntry(rule.id, prizeId)))

                // Draws 1–4 should not trigger pity
                repeat(4) { i ->
                    val result = simulatePityDraw(repo, service, campaignId, playerId, now)
                    result.shouldBeInstanceOf<PityResult.NotTriggered>()
                    result.newDrawCount shouldBe i + 1
                }

                // Draw 5 should trigger pity
                val result5 = simulatePityDraw(repo, service, campaignId, playerId, now)
                result5.shouldBeInstanceOf<PityResult.Triggered>()
                result5.selectedPrizeDefinitionId shouldBe prizeId

                // Verify the tracker was reset to 0 after trigger
                val tracker = repo.findTracker(rule.id, playerId)
                tracker shouldNotBe null
                tracker!!.drawCount shouldBe 0
            }
        }

        // =========================================================================
        // Scenario 2 — Counter resets after trigger
        // =========================================================================

        describe("Counter resets after trigger") {
            it("the draw immediately after a pity trigger starts a fresh count from 1") {
                val repo = FakePityRepository()
                val campaignId = CampaignId.generate()
                val playerId = PlayerId.generate()
                val rule = makeRule(campaignId, threshold = 3)

                repo.saveRule(rule)
                repo.replacePool(rule.id, listOf(makePoolEntry(rule.id)))

                // Exhaust the threshold
                repeat(3) { simulatePityDraw(repo, service, campaignId, playerId, now) }

                // The trigger draw resets the count to 0 in the tracker.
                // The very next draw should start from 0 and produce count == 1.
                val resultAfterReset = simulatePityDraw(repo, service, campaignId, playerId, now)
                resultAfterReset.shouldBeInstanceOf<PityResult.NotTriggered>()
                resultAfterReset.newDrawCount shouldBe 1

                val tracker = repo.findTracker(rule.id, playerId)
                tracker!!.drawCount shouldBe 1
            }
        }

        // =========================================================================
        // Scenario 3 — SESSION mode timeout resets counter
        // =========================================================================

        describe("SESSION mode timeout resets counter") {
            it("draws past the session timeout are treated as a fresh start") {
                val repo = FakePityRepository()
                val campaignId = CampaignId.generate()
                val playerId = PlayerId.generate()
                // 5-minute session timeout, threshold high enough to never auto-trigger
                val rule =
                    makeRule(
                        campaignId,
                        threshold = 100,
                        mode = AccumulationMode.SESSION,
                        sessionTimeout = 300,
                    )

                repo.saveRule(rule)
                repo.replacePool(rule.id, listOf(makePoolEntry(rule.id)))

                // Draw 5 times within the session
                val withinSession = now
                repeat(5) { simulatePityDraw(repo, service, campaignId, playerId, withinSession) }

                // Confirm count reached 5
                val trackerBefore = repo.findTracker(rule.id, playerId)
                trackerBefore!!.drawCount shouldBe 5

                // Simulate draw past the session timeout (6 minutes > 5 minute timeout)
                val afterTimeout = now.plus(6.minutes)
                val resultAfterTimeout =
                    simulatePityDraw(repo, service, campaignId, playerId, afterTimeout)

                // The domain service should have treated elapsed count as 0 and returned count 1
                resultAfterTimeout.shouldBeInstanceOf<PityResult.NotTriggered>()
                resultAfterTimeout.newDrawCount shouldBe 1

                val trackerAfter = repo.findTracker(rule.id, playerId)
                trackerAfter!!.drawCount shouldBe 1
            }

            it("draws within session timeout continue accumulating count") {
                val repo = FakePityRepository()
                val campaignId = CampaignId.generate()
                val playerId = PlayerId.generate()
                val rule =
                    makeRule(
                        campaignId,
                        threshold = 100,
                        mode = AccumulationMode.SESSION,
                        sessionTimeout = 300,
                    )

                repo.saveRule(rule)
                repo.replacePool(rule.id, listOf(makePoolEntry(rule.id)))

                val t1 = now
                simulatePityDraw(repo, service, campaignId, playerId, t1)

                // Draw again 30 seconds later (within the 5-minute timeout)
                val t2 = now.plus(30.seconds)
                val result = simulatePityDraw(repo, service, campaignId, playerId, t2)

                result.shouldBeInstanceOf<PityResult.NotTriggered>()
                result.newDrawCount shouldBe 2
            }
        }

        // =========================================================================
        // Scenario 4 — No pity rule configured
        // =========================================================================

        describe("No pity rule configured") {
            it("returns null when no rule exists for the campaign") {
                val repo = FakePityRepository()
                val campaignId = CampaignId.generate()
                val playerId = PlayerId.generate()

                // Intentionally do NOT save a rule for this campaign
                val result = simulatePityDraw(repo, service, campaignId, playerId, now)

                result shouldBe null
            }
        }

        // =========================================================================
        // Scenario 5 — Disabled rule
        // =========================================================================

        describe("Disabled pity rule") {
            it("returns null when rule exists but enabled = false") {
                val repo = FakePityRepository()
                val campaignId = CampaignId.generate()
                val playerId = PlayerId.generate()
                val rule = makeRule(campaignId, threshold = 5, enabled = false)

                repo.saveRule(rule)
                repo.replacePool(rule.id, listOf(makePoolEntry(rule.id)))

                val result = simulatePityDraw(repo, service, campaignId, playerId, now)

                // Disabled rule is treated as "no pity" — normal draw proceeds unaffected
                result shouldBe null

                // Confirm that the tracker was never written (no side-effects)
                val tracker = repo.findTracker(rule.id, playerId)
                tracker shouldBe null
            }
        }
    })
