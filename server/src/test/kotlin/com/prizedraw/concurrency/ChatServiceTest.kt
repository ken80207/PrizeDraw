package com.prizedraw.concurrency

import com.prizedraw.application.ports.output.IChatRepository
import com.prizedraw.application.services.ChatService
import com.prizedraw.application.services.RateLimitExceededException
import com.prizedraw.domain.entities.ChatMessage
import com.prizedraw.infrastructure.external.redis.RedisClient
import com.prizedraw.infrastructure.external.redis.RedisPubSub
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.datetime.Clock
import java.util.UUID

/**
 * Unit tests for [ChatService].
 *
 * Verifies rate limiting, reaction validation, content sanitization, and length enforcement.
 * All Redis interactions are mocked — no in-process Redis required.
 */
class ChatServiceTest :
    DescribeSpec({

        fun makeService(
            chatRepo: IChatRepository = mockk(relaxed = true),
            redisPubSub: RedisPubSub = mockk(relaxed = true),
            redisClient: RedisClient = mockk(),
            rateLimitCount: Long = 1L,
        ): ChatService {
            coEvery { chatRepo.save(any()) } answers { firstArg() }
            coEvery { redisPubSub.publish(any(), any()) } returns Unit

            // Wire the Redis rate-limit counter behaviour
            coEvery { redisClient.withConnection<Long>(any()) } returns rateLimitCount

            return ChatService(chatRepo, redisPubSub, redisClient)
        }

        afterEach { clearAllMocks() }

        describe("sendMessage") {
            it("persists and broadcasts a valid message") {
                val chatRepo = mockk<IChatRepository>()
                val redisPubSub = mockk<RedisPubSub>()
                val redisClient = mockk<RedisClient>()
                val savedSlot = slot<ChatMessage>()
                val publishedSlot = slot<String>()

                coEvery { chatRepo.save(capture(savedSlot)) } answers { firstArg() }
                coEvery { redisPubSub.publish(any(), capture(publishedSlot)) } returns Unit
                coEvery { redisClient.withConnection<Long>(any()) } returns 1L

                val service = ChatService(chatRepo, redisPubSub, redisClient)
                val playerId = UUID.randomUUID()

                service.sendMessage("kuji:abc", playerId, "Alice", "Hello!")

                savedSlot.captured.message shouldBe "Hello!"
                savedSlot.captured.playerId shouldBe playerId
                publishedSlot.captured shouldContain "CHAT_MESSAGE"
                publishedSlot.captured shouldContain "Hello!"
            }

            it("throws IllegalArgumentException when message is blank") {
                val service = makeService()

                shouldThrow<IllegalArgumentException> {
                    service.sendMessage("kuji:abc", UUID.randomUUID(), "Alice", "   ")
                }
            }

            it("throws IllegalArgumentException when message exceeds MAX_MESSAGE_LENGTH") {
                val service = makeService()
                val longMessage = "A".repeat(ChatService.MAX_MESSAGE_LENGTH + 1)

                shouldThrow<IllegalArgumentException> {
                    service.sendMessage("kuji:abc", UUID.randomUUID(), "Alice", longMessage)
                }
            }

            it("accepts a message exactly at MAX_MESSAGE_LENGTH") {
                val chatRepo = mockk<IChatRepository>(relaxed = true)
                val redisPubSub = mockk<RedisPubSub>(relaxed = true)
                val redisClient = mockk<RedisClient>()
                coEvery { redisClient.withConnection<Long>(any()) } returns 1L

                val service = ChatService(chatRepo, redisPubSub, redisClient)
                val exactMessage = "B".repeat(ChatService.MAX_MESSAGE_LENGTH)

                // Must not throw
                service.sendMessage("kuji:abc", UUID.randomUUID(), "Bob", exactMessage)

                coVerify(exactly = 1) { chatRepo.save(any()) }
            }

            it("throws RateLimitExceededException when rate limit is exceeded") {
                val chatRepo = mockk<IChatRepository>(relaxed = true)
                val redisPubSub = mockk<RedisPubSub>(relaxed = true)
                val redisClient = mockk<RedisClient>()
                // Counter already at 3 — exceeds limit of 2
                coEvery { redisClient.withConnection<Long>(any()) } returns
                    (ChatService.RATE_LIMIT_PER_SECOND + 1).toLong()

                val service = ChatService(chatRepo, redisPubSub, redisClient)

                shouldThrow<RateLimitExceededException> {
                    service.sendMessage("kuji:abc", UUID.randomUUID(), "Alice", "Spam")
                }
            }

            it("trims whitespace from message before persisting") {
                val chatRepo = mockk<IChatRepository>()
                val redisPubSub = mockk<RedisPubSub>(relaxed = true)
                val redisClient = mockk<RedisClient>()
                val savedSlot = slot<ChatMessage>()

                coEvery { chatRepo.save(capture(savedSlot)) } answers { firstArg() }
                coEvery { redisClient.withConnection<Long>(any()) } returns 1L

                val service = ChatService(chatRepo, redisPubSub, redisClient)

                service.sendMessage("kuji:abc", UUID.randomUUID(), "Alice", "  Hello  ")

                savedSlot.captured.message shouldBe "Hello"
            }
        }

        describe("sendReaction") {
            it("broadcasts a valid reaction without persisting") {
                val chatRepo = mockk<IChatRepository>(relaxed = true)
                val redisPubSub = mockk<RedisPubSub>()
                val redisClient = mockk<RedisClient>()
                val publishedSlot = slot<String>()

                coEvery { redisPubSub.publish(any(), capture(publishedSlot)) } returns Unit
                coEvery { redisClient.withConnection<Long>(any()) } returns 1L

                val service = ChatService(chatRepo, redisPubSub, redisClient)

                service.sendReaction("kuji:abc", UUID.randomUUID(), "Bob", "\uD83C\uDF89") // 🎉

                publishedSlot.captured shouldContain "CHAT_REACTION"
                coVerify(exactly = 0) { chatRepo.save(any()) }
            }

            it("throws IllegalArgumentException when emoji is not in the allowed set") {
                val service = makeService()

                shouldThrow<IllegalArgumentException> {
                    service.sendReaction("kuji:abc", UUID.randomUUID(), "Bob", "\uD83D\uDC7D") // 👽 not allowed
                }
            }

            it("rate-limits reactions the same as messages") {
                val chatRepo = mockk<IChatRepository>(relaxed = true)
                val redisPubSub = mockk<RedisPubSub>(relaxed = true)
                val redisClient = mockk<RedisClient>()
                coEvery { redisClient.withConnection<Long>(any()) } returns
                    (ChatService.RATE_LIMIT_PER_SECOND + 1).toLong()

                val service = ChatService(chatRepo, redisPubSub, redisClient)

                shouldThrow<RateLimitExceededException> {
                    service.sendReaction("kuji:abc", UUID.randomUUID(), "Bob", "\uD83C\uDF89")
                }
            }
        }

        describe("getHistory") {
            it("returns messages from the repository clamped to 1-100") {
                val chatRepo = mockk<IChatRepository>()
                val redisPubSub = mockk<RedisPubSub>(relaxed = true)
                val redisClient = mockk<RedisClient>(relaxed = true)
                val now = Clock.System.now()

                val messages =
                    (1..5).map { i ->
                        ChatMessage(
                            id = UUID.randomUUID(),
                            roomId = "kuji:room1",
                            playerId = UUID.randomUUID(),
                            playerNickname = "Player$i",
                            message = "Message $i",
                            isReaction = false,
                            createdAt = now,
                        )
                    }

                coEvery { chatRepo.findByRoom("kuji:room1", 5, null) } returns messages

                val service = ChatService(chatRepo, redisPubSub, redisClient)
                val result = service.getHistory("kuji:room1", 5)

                result.size shouldBe 5
                coVerify { chatRepo.findByRoom("kuji:room1", 5, null) }
            }

            it("clamps limit below 1 to 1") {
                val chatRepo = mockk<IChatRepository>()
                val redisPubSub = mockk<RedisPubSub>(relaxed = true)
                val redisClient = mockk<RedisClient>(relaxed = true)

                coEvery { chatRepo.findByRoom(any(), 1, null) } returns emptyList()

                val service = ChatService(chatRepo, redisPubSub, redisClient)
                service.getHistory("kuji:room1", 0)

                coVerify { chatRepo.findByRoom(any(), 1, null) }
            }

            it("clamps limit above 100 to 100") {
                val chatRepo = mockk<IChatRepository>()
                val redisPubSub = mockk<RedisPubSub>(relaxed = true)
                val redisClient = mockk<RedisClient>(relaxed = true)

                coEvery { chatRepo.findByRoom(any(), 100, null) } returns emptyList()

                val service = ChatService(chatRepo, redisPubSub, redisClient)
                service.getHistory("kuji:room1", 200)

                coVerify { chatRepo.findByRoom(any(), 100, null) }
            }
        }
    })
