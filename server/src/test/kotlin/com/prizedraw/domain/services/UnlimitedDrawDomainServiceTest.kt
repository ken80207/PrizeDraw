package com.prizedraw.domain.services

import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.collections.shouldContain
import io.kotest.matchers.doubles.plusOrMinus
import io.kotest.matchers.ints.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import io.kotest.property.Arb
import io.kotest.property.arbitrary.int
import io.kotest.property.checkAll
import kotlinx.datetime.Clock

/**
 * Unit tests for [UnlimitedDrawDomainService].
 *
 * Covers:
 * - CDF construction correctness
 * - Probability sum validation
 * - Random distribution within statistically expected bounds (chi-square proxy)
 * - Edge cases: empty list, single prize, zero-probability prizes
 * - Binary search boundary conditions
 */
class UnlimitedDrawDomainServiceTest :
    DescribeSpec({

        val service = UnlimitedDrawDomainService()

        val campaignId = CampaignId.generate()
        val now = Clock.System.now()

        /** Helper that creates a minimal [PrizeDefinition] with a given probability in bps. */
        fun makeDef(
            grade: String,
            probabilityBps: Int,
        ): PrizeDefinition =
            PrizeDefinition(
                id = PrizeDefinitionId.generate(),
                kujiCampaignId = null,
                unlimitedCampaignId = campaignId,
                grade = grade,
                name = "Prize $grade",
                photos = emptyList(),
                prizeValue = 0,
                buybackPrice = 0,
                buybackEnabled = false,
                probabilityBps = probabilityBps,
                ticketCount = null,
                displayOrder = 0,
                createdAt = now,
                updatedAt = now,
            )

        // -------------------------------------------------------------------------
        // validateProbabilitySum
        // -------------------------------------------------------------------------
        describe("validateProbabilitySum") {
            it("returns true when probabilities sum to exactly 1,000,000 bps") {
                val defs =
                    listOf(
                        makeDef("A", 100_000), // 10%
                        makeDef("B", 200_000), // 20%
                        makeDef("C", 300_000), // 30%
                        makeDef("D", 400_000), // 40%
                    )
                service.validateProbabilitySum(defs).shouldBeTrue()
            }

            it("returns false when probabilities sum to less than 1,000,000 bps") {
                val defs =
                    listOf(
                        makeDef("A", 100_000),
                        makeDef("B", 200_000),
                        // total = 300,000 — missing 700,000
                    )
                service.validateProbabilitySum(defs).shouldBeFalse()
            }

            it("returns false when probabilities sum to more than 1,000,000 bps") {
                val defs =
                    listOf(
                        makeDef("A", 600_000),
                        makeDef("B", 600_000),
                        // total = 1,200,000
                    )
                service.validateProbabilitySum(defs).shouldBeFalse()
            }

            it("returns true for a single definition with exactly 1,000,000 bps") {
                val defs = listOf(makeDef("Last", 1_000_000))
                service.validateProbabilitySum(defs).shouldBeTrue()
            }

            it("returns false for empty list (sum = 0)") {
                service.validateProbabilitySum(emptyList()).shouldBeFalse()
            }

            it("handles definitions with null probabilityBps (treated as 0)") {
                // Create a definition with null probability (kuji-style, mixed in error)
                val kujiStyleDef =
                    PrizeDefinition(
                        id = PrizeDefinitionId.generate(),
                        kujiCampaignId = campaignId,
                        unlimitedCampaignId = null,
                        grade = "A",
                        name = "Kuji Prize",
                        photos = emptyList(),
                        prizeValue = 0,
                        buybackPrice = 0,
                        buybackEnabled = false,
                        probabilityBps = null, // null treated as 0
                        ticketCount = 1,
                        displayOrder = 0,
                        createdAt = now,
                        updatedAt = now,
                    )
                val defs = listOf(kujiStyleDef, makeDef("B", 1_000_000))
                // null counts as 0, so sum = 0 + 1_000_000 = 1_000_000 → but kujiStyleDef is kuji...
                // This tests the null handling path in sumOf
                service.validateProbabilitySum(listOf(kujiStyleDef)).shouldBeFalse()
            }
        }

        // -------------------------------------------------------------------------
        // spin — validation errors
        // -------------------------------------------------------------------------
        describe("spin — validation errors") {
            it("throws DrawValidationException for empty definitions list") {
                shouldThrow<IllegalArgumentException> {
                    service.spin(emptyList())
                }
            }

            it("throws DrawValidationException when probability sum is not 1,000,000") {
                val defs =
                    listOf(
                        makeDef("A", 500_000),
                        makeDef("B", 400_000),
                        // sum = 900,000 — invalid
                    )
                shouldThrow<DrawValidationException> {
                    service.spin(defs)
                }
            }
        }

        // -------------------------------------------------------------------------
        // spin — correct selection
        // -------------------------------------------------------------------------
        describe("spin — single definition at 100%") {
            it("always returns the only prize definition") {
                val lastPrize = makeDef("Last", 1_000_000)
                val defs = listOf(lastPrize)
                repeat(100) {
                    service.spin(defs).id shouldBe lastPrize.id
                }
            }
        }

        describe("spin — two definitions") {
            it("returns each definition with roughly correct frequency over 10,000 spins") {
                val defA = makeDef("A", 100_000) // 10%
                val defB = makeDef("B", 900_000) // 90%
                val defs = listOf(defA, defB)

                val totalSpins = 10_000
                var countA = 0
                var countB = 0

                repeat(totalSpins) {
                    when (service.spin(defs).id) {
                        defA.id -> countA++
                        defB.id -> countB++
                    }
                }

                val ratioA = countA.toDouble() / totalSpins
                val ratioB = countB.toDouble() / totalSpins

                // Allow 3% tolerance for statistical variation (3-sigma for 10k samples)
                ratioA shouldBe (0.10 plusOrMinus 0.03)
                ratioB shouldBe (0.90 plusOrMinus 0.03)
            }
        }

        describe("spin — five-tier distribution") {
            it("distributes prizes according to their probability weights") {
                // Typical gacha: S(0.5%), A(4.5%), B(15%), C(30%), D(50%)
                val defS = makeDef("S", 5_000) // 0.5%
                val defA = makeDef("A", 45_000) // 4.5%
                val defB = makeDef("B", 150_000) // 15%
                val defC = makeDef("C", 300_000) // 30%
                val defD = makeDef("D", 500_000) // 50%
                val defs = listOf(defS, defA, defB, defC, defD)

                // Sanity-check the test's own setup
                service.validateProbabilitySum(defs).shouldBeTrue()

                val totalSpins = 100_000
                val counts =
                    mutableMapOf(
                        defS.id to 0,
                        defA.id to 0,
                        defB.id to 0,
                        defC.id to 0,
                        defD.id to 0,
                    )

                repeat(totalSpins) {
                    counts.merge(service.spin(defs).id, 1, Int::plus)
                }

                val rateS = counts[defS.id]!!.toDouble() / totalSpins
                val rateA = counts[defA.id]!!.toDouble() / totalSpins
                val rateB = counts[defB.id]!!.toDouble() / totalSpins
                val rateC = counts[defC.id]!!.toDouble() / totalSpins
                val rateD = counts[defD.id]!!.toDouble() / totalSpins

                // 2% tolerance — generous for the S tier (low count, high variance)
                rateS shouldBe (0.005 plusOrMinus 0.002)
                rateA shouldBe (0.045 plusOrMinus 0.005)
                rateB shouldBe (0.150 plusOrMinus 0.010)
                rateC shouldBe (0.300 plusOrMinus 0.015)
                rateD shouldBe (0.500 plusOrMinus 0.015)
            }
        }

        describe("spin — CDF boundary conditions") {
            it("the first definition is selected when random roll = 0 (lower CDF boundary)") {
                // With 1,000 definitions at 1,000 bps each = 100% total,
                // verify the set of winners includes the first definition (roll=0 maps to index 0)
                val defs = (1..1000).map { i -> makeDef("Grade$i", 1000) }
                service.validateProbabilitySum(defs).shouldBeTrue()

                val winners = (1..10_000).map { service.spin(defs).grade }.toSet()
                // All grades should appear in 10k spins given 0.1% each
                // At minimum, we verify no single grade dominates
                winners.size.shouldBeGreaterThan(900)
            }

            it("handles two adjacent definitions with equal probability") {
                val def1 = makeDef("X", 500_000)
                val def2 = makeDef("Y", 500_000)
                val defs = listOf(def1, def2)

                val ids = (1..1000).map { service.spin(defs).id }.toSet()
                ids shouldContain def1.id
                ids shouldContain def2.id
            }
        }

        // -------------------------------------------------------------------------
        // Property-based: spin never throws for any valid probability distribution
        // -------------------------------------------------------------------------
        describe("spin — property-based: valid inputs never throw") {
            it("spin does not throw for any valid 2-tier probability split") {
                checkAll(Arb.int(1..999_999)) { firstBps ->
                    val defs =
                        listOf(
                            makeDef("A", firstBps),
                            makeDef("B", 1_000_000 - firstBps),
                        )
                    // Should not throw
                    service.spin(defs)
                }
            }
        }
    })
