package com.prizedraw.domain.events

import com.prizedraw.application.events.ExchangeCounterProposed
import com.prizedraw.application.events.ExchangeRejected
import com.prizedraw.application.events.ExchangeRequested
import com.prizedraw.application.events.PaymentFailed
import com.prizedraw.application.events.PlayerLevelUp
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import java.util.UUID

class DomainEventTest :
    DescribeSpec({
        describe("ExchangeRequested") {
            it("has correct event type and aggregate type") {
                val event =
                    ExchangeRequested(
                        exchangeRequestId = UUID.randomUUID(),
                        initiatorId = UUID.randomUUID(),
                        recipientId = UUID.randomUUID(),
                    )
                event.eventType shouldBe "exchange.requested"
                event.aggregateType shouldBe "ExchangeRequest"
            }
        }

        describe("ExchangeCounterProposed") {
            it("has correct event type") {
                val event =
                    ExchangeCounterProposed(
                        exchangeRequestId = UUID.randomUUID(),
                        proposerId = UUID.randomUUID(),
                        recipientId = UUID.randomUUID(),
                    )
                event.eventType shouldBe "exchange.counter_proposed"
            }
        }

        describe("ExchangeRejected") {
            it("has correct event type") {
                val event =
                    ExchangeRejected(
                        exchangeRequestId = UUID.randomUUID(),
                        rejecterId = UUID.randomUUID(),
                        otherPlayerId = UUID.randomUUID(),
                    )
                event.eventType shouldBe "exchange.rejected"
            }
        }

        describe("PaymentFailed") {
            it("has correct event type") {
                val event =
                    PaymentFailed(
                        paymentOrderId = UUID.randomUUID(),
                        playerId = UUID.randomUUID(),
                        reason = "Card declined",
                    )
                event.eventType shouldBe "payment.failed"
            }
        }

        describe("PlayerLevelUp") {
            it("has correct event type") {
                val event =
                    PlayerLevelUp(
                        playerId = UUID.randomUUID(),
                        newLevel = 5,
                        newTierName = "Gold",
                    )
                event.eventType shouldBe "player.level_up"
                event.aggregateType shouldBe "Player"
            }
        }
    })
