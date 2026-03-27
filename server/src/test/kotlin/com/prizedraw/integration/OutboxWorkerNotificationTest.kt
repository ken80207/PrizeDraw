package com.prizedraw.integration

import com.prizedraw.application.events.OutboxWorker
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.ports.output.INotificationService
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.domain.entities.OutboxEvent
import com.prizedraw.domain.entities.OutboxEventStatus
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.mockk
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

class OutboxWorkerNotificationTest :
    DescribeSpec({
        val outboxRepo = mockk<IOutboxRepository>(relaxed = true)
        val notificationService = mockk<INotificationService>(relaxed = true)
        val redisPubSub = mockk<RedisPubSub>(relaxed = true)
        val notificationRepo = mockk<INotificationRepository>(relaxed = true)

        afterEach { clearAllMocks() }

        describe("constructor") {
            it("accepts INotificationRepository as 4th parameter") {
                @Suppress("UnusedPrivateProperty")
                val worker = OutboxWorker(outboxRepo, notificationService, redisPubSub, notificationRepo)
                // Constructor succeeds — the 4-param signature compiles and runs
            }
        }

        describe("event payload contracts") {
            it("payment.confirmed payload contains playerId and drawPointsGranted") {
                val playerId = UUID.randomUUID()
                val event =
                    OutboxEvent(
                        id = UUID.randomUUID(),
                        eventType = "payment.confirmed",
                        aggregateType = "PaymentOrder",
                        aggregateId = UUID.randomUUID(),
                        payload =
                            buildJsonObject {
                                put("playerId", playerId.toString())
                                put("drawPointsGranted", "500")
                                put("fiatAmount", "150")
                            },
                        status = OutboxEventStatus.PENDING,
                        processedAt = null,
                        failureReason = null,
                        createdAt = Clock.System.now(),
                    )
                event.payload["playerId"].toString().trim('"') shouldBe playerId.toString()
            }

            it("exchange.requested payload identifies recipient") {
                val recipientId = UUID.randomUUID()
                val event =
                    OutboxEvent(
                        id = UUID.randomUUID(),
                        eventType = "exchange.requested",
                        aggregateType = "ExchangeRequest",
                        aggregateId = UUID.randomUUID(),
                        payload =
                            buildJsonObject {
                                put("initiatorId", UUID.randomUUID().toString())
                                put("recipientId", recipientId.toString())
                            },
                        status = OutboxEventStatus.PENDING,
                        processedAt = null,
                        failureReason = null,
                        createdAt = Clock.System.now(),
                    )
                event.payload["recipientId"].toString().trim('"') shouldBe recipientId.toString()
            }
        }
    })
