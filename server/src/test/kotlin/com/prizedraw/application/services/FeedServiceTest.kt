package com.prizedraw.application.services

import com.prizedraw.application.ports.output.IFeedEventRepository
import com.prizedraw.application.ports.output.IPubSubService
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.FeedEvent
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.collections.shouldHaveSize
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.datetime.Clock
import java.util.UUID

class FeedServiceTest :
    DescribeSpec({

        afterEach { clearAllMocks() }

        describe("publishDrawEvent") {
            it("persists a FeedEvent row and publishes a JSON event to the feed:draws Redis channel") {
                val pubSub = mockk<IPubSubService>()
                val feedEventRepo = mockk<IFeedEventRepository>()
                coEvery { feedEventRepo.save(any()) } returns Unit
                val service = FeedService(pubSub, feedEventRepo)
                val payload = slot<String>()
                coEvery { pubSub.publish("feed:draws", capture(payload)) } returns Unit

                service.publishDrawEvent(
                    drawId = "draw-123",
                    playerId = UUID.randomUUID().toString(),
                    playerNickname = "TestPlayer",
                    playerAvatarUrl = null,
                    campaignId = UUID.randomUUID().toString(),
                    campaignTitle = "Summer Festival",
                    campaignType = CampaignType.KUJI,
                    prizeGrade = "SSR",
                    prizeName = "Limited Figure",
                    prizePhotoUrl = "https://example.com/photo.jpg",
                    drawnAt = Clock.System.now(),
                )

                payload.captured shouldContain "TestPlayer"
                payload.captured shouldContain "Summer Festival"
                payload.captured shouldContain "SSR"
                payload.captured shouldContain "Limited Figure"
                payload.captured shouldContain "feed_event"

                coVerify(exactly = 1) { feedEventRepo.save(any()) }
            }
        }

        describe("getRecentEvents") {
            it("maps FeedEvent rows to DrawFeedEventDto without additional queries") {
                val pubSub = mockk<IPubSubService>()
                val feedEventRepo = mockk<IFeedEventRepository>()
                val now = Clock.System.now()
                val campaignId = UUID.randomUUID()
                val playerId = UUID.randomUUID()
                val event =
                    FeedEvent(
                        id = UUID.randomUUID(),
                        drawId = "draw-abc",
                        playerId = playerId,
                        playerNickname = "Alice",
                        playerAvatarUrl = null,
                        campaignId = campaignId,
                        campaignTitle = "Winter Draw",
                        campaignType = CampaignType.UNLIMITED,
                        prizeGrade = "A",
                        prizeName = "Gold Figure",
                        prizePhotoUrl = null,
                        drawnAt = now,
                        createdAt = now,
                    )
                coEvery { feedEventRepo.findRecent(10) } returns listOf(event)
                val service = FeedService(pubSub, feedEventRepo)

                val result = service.getRecentEvents(10)

                result shouldHaveSize 1
                result[0].drawId shouldBe "draw-abc"
                result[0].playerNickname shouldBe "Alice"
                result[0].campaignType shouldBe CampaignType.UNLIMITED
            }
        }
    })
