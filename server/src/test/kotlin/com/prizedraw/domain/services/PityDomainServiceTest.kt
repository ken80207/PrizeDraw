package com.prizedraw.domain.services

import com.prizedraw.domain.entities.AccumulationMode
import com.prizedraw.domain.entities.PityPrizePoolEntry
import com.prizedraw.domain.entities.PityRule
import com.prizedraw.domain.entities.PityTracker
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.shouldBe
import io.kotest.matchers.types.shouldBeInstanceOf
import kotlinx.datetime.Clock
import java.util.UUID
import kotlin.time.Duration.Companion.minutes
import kotlin.time.Duration.Companion.seconds

class PityDomainServiceTest :
    DescribeSpec({
        val service = PityDomainService()
        val now = Clock.System.now()
        val ruleId = UUID.randomUUID()
        val campaignId = CampaignId.generate()
        val playerId = PlayerId.generate()

        fun makeRule(
            threshold: Int = 10,
            mode: AccumulationMode = AccumulationMode.PERSISTENT,
            sessionTimeout: Int? = null,
        ): PityRule =
            PityRule(
                id = ruleId,
                campaignId = campaignId,
                campaignType = "UNLIMITED",
                threshold = threshold,
                accumulationMode = mode,
                sessionTimeoutSeconds = sessionTimeout,
                enabled = true,
                createdAt = now,
                updatedAt = now,
            )

        fun makeTracker(
            drawCount: Int = 0,
            lastDrawAt: kotlinx.datetime.Instant? = now,
        ): PityTracker =
            PityTracker(
                id = UUID.randomUUID(),
                pityRuleId = ruleId,
                playerId = playerId,
                drawCount = drawCount,
                lastDrawAt = lastDrawAt,
                version = 0,
                createdAt = now,
                updatedAt = now,
            )

        fun makePool(vararg weights: Int): List<PityPrizePoolEntry> =
            weights.map { w ->
                PityPrizePoolEntry(
                    id = UUID.randomUUID(),
                    pityRuleId = ruleId,
                    prizeDefinitionId = PrizeDefinitionId.generate(),
                    weight = w,
                )
            }

        describe("evaluate — not triggered") {
            it("increments drawCount when below threshold") {
                val result =
                    service.evaluate(
                        rule = makeRule(threshold = 10),
                        tracker = makeTracker(drawCount = 5),
                        pool = makePool(100),
                        now = now,
                    )
                result.shouldBeInstanceOf<PityResult.NotTriggered>()
                result.newDrawCount shouldBe 6
            }
        }

        describe("evaluate — triggered at threshold") {
            it("triggers and resets drawCount when drawCount + 1 == threshold") {
                val pool = makePool(100)
                val result =
                    service.evaluate(
                        rule = makeRule(threshold = 10),
                        tracker = makeTracker(drawCount = 9),
                        pool = pool,
                        now = now,
                    )
                result.shouldBeInstanceOf<PityResult.Triggered>()
                result.newDrawCount shouldBe 0
                result.selectedPrizeDefinitionId shouldBe pool[0].prizeDefinitionId
            }
        }

        describe("evaluate — SESSION mode timeout resets counter") {
            it("resets drawCount to 0 before incrementing when session expired") {
                val rule = makeRule(threshold = 10, mode = AccumulationMode.SESSION, sessionTimeout = 300)
                val expiredTracker =
                    makeTracker(
                        drawCount = 8,
                        lastDrawAt = now.minus(6.minutes),
                    )
                val result =
                    service.evaluate(
                        rule = rule,
                        tracker = expiredTracker,
                        pool = makePool(100),
                        now = now,
                    )
                result.shouldBeInstanceOf<PityResult.NotTriggered>()
                result.newDrawCount shouldBe 1
            }

            it("does not reset when session is still active") {
                val rule = makeRule(threshold = 10, mode = AccumulationMode.SESSION, sessionTimeout = 300)
                val activeTracker =
                    makeTracker(
                        drawCount = 8,
                        lastDrawAt = now.minus(60.seconds),
                    )
                val result =
                    service.evaluate(
                        rule = rule,
                        tracker = activeTracker,
                        pool = makePool(100),
                        now = now,
                    )
                result.shouldBeInstanceOf<PityResult.NotTriggered>()
                result.newDrawCount shouldBe 9
            }
        }

        describe("evaluate — weighted pool selection") {
            it("selects from pool according to weights over many evaluations") {
                val defA = PrizeDefinitionId.generate()
                val defB = PrizeDefinitionId.generate()
                val pool =
                    listOf(
                        PityPrizePoolEntry(UUID.randomUUID(), ruleId, defA, 10),
                        PityPrizePoolEntry(UUID.randomUUID(), ruleId, defB, 90),
                    )
                val rule = makeRule(threshold = 1)
                val counts = mutableMapOf(defA to 0, defB to 0)

                repeat(10_000) {
                    val result =
                        service.evaluate(
                            rule = rule,
                            tracker = makeTracker(drawCount = 0),
                            pool = pool,
                            now = now,
                        )
                    result.shouldBeInstanceOf<PityResult.Triggered>()
                    counts.merge(result.selectedPrizeDefinitionId, 1, Int::plus)
                }

                val rateA = counts[defA]!!.toDouble() / 10_000
                rateA shouldBe (0.10 plusOrMinus 0.02)
            }
        }

        describe("evaluate — empty pool") {
            it("returns NotTriggered even at threshold when pool is empty") {
                val result =
                    service.evaluate(
                        rule = makeRule(threshold = 1),
                        tracker = makeTracker(drawCount = 0),
                        pool = emptyList(),
                        now = now,
                    )
                result.shouldBeInstanceOf<PityResult.NotTriggered>()
            }
        }

        describe("evaluate — null tracker treated as fresh") {
            it("creates new counter starting at 1") {
                val result =
                    service.evaluate(
                        rule = makeRule(threshold = 10),
                        tracker = null,
                        pool = makePool(100),
                        now = now,
                    )
                result.shouldBeInstanceOf<PityResult.NotTriggered>()
                result.newDrawCount shouldBe 1
            }
        }
    })
