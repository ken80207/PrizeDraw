package com.prizedraw.integration

import com.prizedraw.infrastructure.external.redis.RedisPubSub
import com.prizedraw.infrastructure.websocket.PlayerNotificationManager
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.slot
import io.ktor.server.websocket.DefaultWebSocketServerSession
import kotlinx.coroutines.flow.emptyFlow
import java.util.UUID

class PlayerNotificationManagerTest : DescribeSpec({
    val redisPubSub = mockk<RedisPubSub>(relaxed = true)

    afterEach { clearAllMocks() }

    describe("register / unregister") {
        it("tracks session count per player") {
            coEvery { redisPubSub.subscribe(any()) } returns emptyFlow()
            val manager = PlayerNotificationManager(redisPubSub)
            val session = mockk<DefaultWebSocketServerSession>(relaxed = true)
            val playerId = UUID.randomUUID()

            manager.register(playerId, session)
            manager.sessionCount(playerId) shouldBe 1

            manager.unregister(playerId, session)
            manager.sessionCount(playerId) shouldBe 0
        }

        it("supports multiple sessions per player") {
            coEvery { redisPubSub.subscribe(any()) } returns emptyFlow()
            val manager = PlayerNotificationManager(redisPubSub)
            val session1 = mockk<DefaultWebSocketServerSession>(relaxed = true)
            val session2 = mockk<DefaultWebSocketServerSession>(relaxed = true)
            val playerId = UUID.randomUUID()

            manager.register(playerId, session1)
            manager.register(playerId, session2)
            manager.sessionCount(playerId) shouldBe 2
        }
    }

    describe("Redis channel convention") {
        it("subscribes to ws:player:{playerId}") {
            val channelSlot = slot<String>()
            coEvery { redisPubSub.subscribe(capture(channelSlot)) } returns emptyFlow()
            val manager = PlayerNotificationManager(redisPubSub)
            val session = mockk<DefaultWebSocketServerSession>(relaxed = true)
            val playerId = UUID.randomUUID()

            manager.register(playerId, session)
            channelSlot.captured shouldBe "ws:player:$playerId"
        }
    }
})
