package com.prizedraw.domain.services

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.booleans.shouldBeFalse
import io.kotest.matchers.booleans.shouldBeTrue
import io.kotest.matchers.shouldBe
import java.math.BigDecimal
import java.math.RoundingMode

class MarginRiskServiceTest :
    DescribeSpec({

        val service = MarginRiskService()
        val threshold = BigDecimal("20.00")

        describe("calculateUnlimitedMargin") {
            it("should calculate correct margin for a profitable campaign") {
                val prizes = listOf(
                    UnlimitedPrizeInput(probabilityBps = 500_000, prizeValue = 80),
                    UnlimitedPrizeInput(probabilityBps = 500_000, prizeValue = 40),
                )
                val result = service.calculateUnlimitedMargin(
                    pricePerDraw = 100,
                    prizes = prizes,
                    thresholdPct = threshold,
                )
                result.totalRevenuePerUnit shouldBe 100
                result.totalCostPerUnit shouldBe 60
                result.profitPerUnit shouldBe 40
                result.marginPct.setScale(2, RoundingMode.HALF_UP) shouldBe BigDecimal("40.00")
                result.belowThreshold.shouldBeFalse()
            }

            it("should flag below threshold when margin is under 20%") {
                val prizes = listOf(
                    UnlimitedPrizeInput(probabilityBps = 1_000_000, prizeValue = 90),
                )
                val result = service.calculateUnlimitedMargin(
                    pricePerDraw = 100,
                    prizes = prizes,
                    thresholdPct = threshold,
                )
                result.marginPct.setScale(2, RoundingMode.HALF_UP) shouldBe BigDecimal("10.00")
                result.belowThreshold.shouldBeTrue()
            }

            it("should handle negative margin (loss)") {
                val prizes = listOf(
                    UnlimitedPrizeInput(probabilityBps = 1_000_000, prizeValue = 150),
                )
                val result = service.calculateUnlimitedMargin(
                    pricePerDraw = 100,
                    prizes = prizes,
                    thresholdPct = threshold,
                )
                result.profitPerUnit shouldBe -50
                result.belowThreshold.shouldBeTrue()
            }
        }

        describe("calculateKujiMargin") {
            it("should calculate correct margin for a kuji campaign") {
                val prizes = listOf(
                    KujiPrizeInput(ticketCount = 5, prizeValue = 100),
                    KujiPrizeInput(ticketCount = 5, prizeValue = 50),
                )
                val result = service.calculateKujiMargin(
                    pricePerDraw = 100,
                    prizes = prizes,
                    boxCount = 1,
                    thresholdPct = threshold,
                )
                result.totalRevenuePerUnit shouldBe 1000
                result.totalCostPerUnit shouldBe 750
                result.profitPerUnit shouldBe 250
                result.marginPct.setScale(2, RoundingMode.HALF_UP) shouldBe BigDecimal("25.00")
                result.belowThreshold.shouldBeFalse()
            }

            it("should scale with box count") {
                val prizes = listOf(
                    KujiPrizeInput(ticketCount = 10, prizeValue = 80),
                )
                val result = service.calculateKujiMargin(
                    pricePerDraw = 100,
                    prizes = prizes,
                    boxCount = 3,
                    thresholdPct = threshold,
                )
                result.totalRevenuePerUnit shouldBe 3000
                result.totalCostPerUnit shouldBe 2400
            }
        }
    })
