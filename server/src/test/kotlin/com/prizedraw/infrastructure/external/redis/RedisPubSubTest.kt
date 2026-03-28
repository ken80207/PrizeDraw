package com.prizedraw.infrastructure.external.redis

import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.shouldBe
import io.mockk.mockk
import kotlinx.coroutines.Job
import kotlinx.coroutines.cancelAndJoin
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import java.util.concurrent.ConcurrentHashMap

class RedisPubSubTest :
    DescribeSpec({
        describe("subscribe") {
            it("removes listener registration when the collector is cancelled") {
                val pubSub = RedisPubSub(mockk<RedisClient>(relaxed = true))
                val listenersField = RedisPubSub::class.java.getDeclaredField("listeners")
                listenersField.isAccessible = true

                runBlocking {
                    val job: Job =
                        launch {
                            pubSub.subscribe("ws:player:test").collect()
                        }

                    @Suppress("UNCHECKED_CAST")
                    val listeners =
                        listenersField.get(pubSub) as ConcurrentHashMap<String, MutableList<*>>
                    repeat(20) {
                        if (listeners["ws:player:test"]?.size == 1) return@repeat
                        delay(10)
                    }
                    listeners["ws:player:test"]?.size shouldBe 1

                    job.cancelAndJoin()

                    listeners["ws:player:test"]?.size ?: 0 shouldBe 0
                }
            }
        }
    })
