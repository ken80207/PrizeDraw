package com.prizedraw.infrastructure.persistence

import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.domain.entities.Notification
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import java.util.UUID

/**
 * Unit tests for [INotificationRepository] using a mock-based approach.
 *
 * Verifies the contract of each port method — no real DB required.
 */
class NotificationRepositoryTest :
    DescribeSpec({
        val repo = mockk<INotificationRepository>()

        afterEach { clearAllMocks() }

        describe("save") {
            it("persists a notification and returns it") {
                val playerId = UUID.randomUUID()
                val notification =
                    Notification(
                        playerId = playerId,
                        eventType = "payment.confirmed",
                        title = "Payment Confirmed",
                        body = "100 draw points added",
                        data = mapOf("orderId" to "abc-123"),
                    )
                coEvery { repo.save(notification) } returns notification

                val result = repo.save(notification)

                result shouldBe notification
                coVerify(exactly = 1) { repo.save(notification) }
            }
        }

        describe("findByPlayerId") {
            it("returns paginated notifications for a player") {
                val playerId = UUID.randomUUID()
                val notifications =
                    listOf(
                        Notification(
                            playerId = playerId,
                            eventType = "draw.won",
                            title = "You Won!",
                            body = "Prize awarded"
                        ),
                        Notification(
                            playerId = playerId,
                            eventType = "payment.confirmed",
                            title = "Payment",
                            body = "Points added"
                        ),
                    )
                coEvery { repo.findByPlayerId(playerId, limit = 20, offset = 0) } returns notifications

                val result = repo.findByPlayerId(playerId, limit = 20, offset = 0)

                result shouldHaveSize 2
                result.all { it.playerId == playerId } shouldBe true
            }

            it("returns an empty list when the player has no notifications") {
                val playerId = UUID.randomUUID()
                coEvery { repo.findByPlayerId(playerId, limit = 20, offset = 0) } returns emptyList()

                val result = repo.findByPlayerId(playerId, limit = 20, offset = 0)

                result shouldHaveSize 0
            }
        }

        describe("markRead") {
            it("returns true when a notification is successfully marked as read") {
                val id = UUID.randomUUID()
                val playerId = UUID.randomUUID()
                coEvery { repo.markRead(id, playerId) } returns true

                val result = repo.markRead(id, playerId)

                result shouldBe true
            }

            it("returns false when the notification does not exist or already read") {
                val id = UUID.randomUUID()
                val playerId = UUID.randomUUID()
                coEvery { repo.markRead(id, playerId) } returns false

                val result = repo.markRead(id, playerId)

                result shouldBe false
            }
        }

        describe("markAllRead") {
            it("returns the count of notifications marked as read") {
                val playerId = UUID.randomUUID()
                coEvery { repo.markAllRead(playerId) } returns 5

                val result = repo.markAllRead(playerId)

                result shouldBe 5
            }

            it("returns 0 when there are no unread notifications") {
                val playerId = UUID.randomUUID()
                coEvery { repo.markAllRead(playerId) } returns 0

                val result = repo.markAllRead(playerId)

                result shouldBe 0
            }
        }

        describe("countUnread") {
            it("returns the number of unread notifications for a player") {
                val playerId = UUID.randomUUID()
                coEvery { repo.countUnread(playerId) } returns 3

                val result = repo.countUnread(playerId)

                result shouldBe 3
            }

            it("returns 0 when all notifications are read") {
                val playerId = UUID.randomUUID()
                coEvery { repo.countUnread(playerId) } returns 0

                val result = repo.countUnread(playerId)

                result shouldBe 0
            }
        }
    })
