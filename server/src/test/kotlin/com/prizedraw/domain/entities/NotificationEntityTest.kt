package com.prizedraw.domain.entities

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import java.util.UUID

class NotificationEntityTest :
    DescribeSpec({
        describe("Notification") {
            it("defaults isRead to false") {
                val n =
                    Notification(
                        id = UUID.randomUUID(),
                        playerId = UUID.randomUUID(),
                        eventType = "payment.confirmed",
                        title = "Payment Confirmed",
                        body = "100 draw points added",
                        data = emptyMap(),
                    )
                n.isRead shouldBe false
            }
        }
    })
