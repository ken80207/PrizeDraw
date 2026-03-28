package com.prizedraw.application.services

import com.prizedraw.application.ports.output.IPubSubService
import com.prizedraw.contracts.enums.CampaignType
import io.kotest.core.spec.style.DescribeSpec
import io.kotest.matchers.string.shouldContain
import io.mockk.clearAllMocks
import io.mockk.coEvery
import io.mockk.mockk
import io.mockk.slot
import kotlinx.datetime.Clock

class FeedServiceTest : DescribeSpec({

    afterEach { clearAllMocks() }

    describe("publishDrawEvent") {
        it("publishes a JSON event to the feed:draws Redis channel") {
            val pubSub = mockk<IPubSubService>()
            val service = FeedService(pubSub)
            val payload = slot<String>()
            coEvery { pubSub.publish("feed:draws", capture(payload)) } returns Unit

            service.publishDrawEvent(
                drawId = "draw-123",
                playerId = "player-456",
                playerNickname = "TestPlayer",
                playerAvatarUrl = null,
                campaignId = "campaign-789",
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
        }
    }
})
