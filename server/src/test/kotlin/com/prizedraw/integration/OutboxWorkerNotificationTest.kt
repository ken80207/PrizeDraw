package com.prizedraw.integration

import com.prizedraw.application.events.OutboxWorker
import com.prizedraw.application.ports.output.IFollowRepository
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.ports.output.INotificationService
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.domain.entities.OutboxEvent
import com.prizedraw.domain.entities.OutboxEventStatus
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
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
        val followRepo = mockk<IFollowRepository>(relaxed = true)

        afterEach { clearAllMocks() }

        describe("constructor") {
            it("accepts INotificationRepository as 4th parameter") {
                @Suppress("UnusedPrivateProperty")
                val worker = OutboxWorker(outboxRepo, notificationService, redisPubSub, notificationRepo, followRepo)
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

        describe("favorite notification delivery") {
            it("persists, publishes, and pushes favorite.campaign_activated events") {
                val playerId = UUID.randomUUID()
                val event =
                    OutboxEvent(
                        id = UUID.randomUUID(),
                        eventType = "favorite.campaign_activated",
                        aggregateType = "Campaign",
                        aggregateId = UUID.randomUUID(),
                        payload =
                            buildJsonObject {
                                put("playerId", playerId.toString())
                                put("campaignId", UUID.randomUUID().toString())
                                put("campaignType", "KUJI")
                            },
                        status = OutboxEventStatus.PENDING,
                        processedAt = null,
                        failureReason = null,
                        createdAt = Clock.System.now(),
                    )
                coEvery { outboxRepo.fetchPending(any()) } returnsMany listOf(listOf(event), emptyList())
                val worker = OutboxWorker(outboxRepo, notificationService, redisPubSub, notificationRepo, followRepo)

                runBlocking {
                    worker.start()
                    delay(150)
                    worker.stop()
                }

                coVerify(atLeast = 1) { notificationRepo.save(any()) }
                coVerify(atLeast = 1) { redisPubSub.publish("ws:player:$playerId", any()) }
                coVerify(atLeast = 1) { notificationService.sendPush(any(), any()) }
            }

            it("persists, publishes, and pushes favorite.campaign_low_stock events") {
                val playerId = UUID.randomUUID()
                val campaignId = UUID.randomUUID()
                val event =
                    OutboxEvent(
                        id = UUID.randomUUID(),
                        eventType = "favorite.campaign_low_stock",
                        aggregateType = "Campaign",
                        aggregateId = campaignId,
                        payload =
                            buildJsonObject {
                                put("playerId", playerId.toString())
                                put("campaignId", campaignId.toString())
                            },
                        status = OutboxEventStatus.PENDING,
                        processedAt = null,
                        failureReason = null,
                        createdAt = Clock.System.now(),
                    )
                coEvery { outboxRepo.fetchPending(any()) } returnsMany listOf(listOf(event), emptyList())
                val worker = OutboxWorker(outboxRepo, notificationService, redisPubSub, notificationRepo, followRepo)

                runBlocking {
                    worker.start()
                    delay(150)
                    worker.stop()
                }

                coVerify(atLeast = 1) { notificationRepo.save(any()) }
                coVerify(atLeast = 1) { redisPubSub.publish("ws:player:$playerId", any()) }
                coVerify(atLeast = 1) { notificationService.sendPush(any(), any()) }
            }
        }
    })
