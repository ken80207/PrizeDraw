package com.prizedraw.domain.services

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldHaveLength
import io.kotest.matchers.string.shouldMatch

class PlayerCodeGeneratorTest :
    DescribeSpec({
        describe("generate") {
            it("produces an 8-character uppercase alphanumeric code") {
                val code = PlayerCodeGenerator.generate()
                code shouldHaveLength 8
                code shouldMatch Regex("^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}$")
            }
            it("excludes confusable characters 0, O, 1, I, L") {
                repeat(100) {
                    val code = PlayerCodeGenerator.generate()
                    code.none { it in "01OIL" } shouldBe true
                }
            }
            it("generates unique codes") {
                val codes = (1..1000).map { PlayerCodeGenerator.generate() }.toSet()
                codes.size shouldBe 1000
            }
        }
    })
