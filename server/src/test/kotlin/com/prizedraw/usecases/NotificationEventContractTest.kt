package com.prizedraw.usecases

import com.prizedraw.application.usecases.exchange.ExchangeCreatedEvent
import com.prizedraw.application.usecases.shipping.ShippingStatusChangedEvent
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import java.util.UUID

class NotificationEventContractTest :
    DescribeSpec({
        describe("ExchangeCreatedEvent") {
            it("uses the outbox event type expected by OutboxWorker") {
                val event = ExchangeCreatedEvent(UUID.randomUUID(), UUID.randomUUID())

                event.eventType shouldBe "exchange.requested"
            }
        }

        describe("ShippingStatusChangedEvent") {
            it("uses the outbox event type expected by OutboxWorker") {
                val event = ShippingStatusChangedEvent(UUID.randomUUID(), UUID.randomUUID(), "SHIPPED")

                event.eventType shouldBe "shipping.status_changed"
            }
        }
    })
