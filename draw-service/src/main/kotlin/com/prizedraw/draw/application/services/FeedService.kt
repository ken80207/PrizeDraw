package com.prizedraw.draw.application.services

import com.prizedraw.contracts.dto.feed.DrawFeedEventDto
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.draw.application.ports.output.IFeedEventRepository
import com.prizedraw.draw.application.ports.output.IPubSubService
import com.prizedraw.draw.domain.entities.FeedEvent
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Application service that publishes draw results to the live feed Redis channel and
 * persists them to the denormalised feed_events table (draw-service copy).
 *
 * Fire-and-forget: failures are logged at WARN level but never propagate to the caller.
 *
 * @param pubSub Output port for Redis pub/sub publishing.
 * @param feedEventRepository Output port for persisting and querying feed events.
 */
public class FeedService(
    private val pubSub: IPubSubService,
    private val feedEventRepository: IFeedEventRepository,
) {
    private val log = LoggerFactory.getLogger(FeedService::class.java)

    /**
     * All fields needed to describe a draw result for the live feed.
     */
    public data class DrawFeedEvent(
        val drawId: String,
        val playerId: String,
        val playerNickname: String,
        val playerAvatarUrl: String?,
        val campaignId: String,
        val campaignTitle: String,
        val campaignType: CampaignType,
        val prizeGrade: String,
        val prizeName: String,
        val prizePhotoUrl: String?,
        val drawnAt: Instant,
        val pityTriggered: Boolean = false,
    )

    /**
     * Serialises the draw result and publishes it to the [CHANNEL] Redis channel,
     * and persists a [FeedEvent] row. Never throws.
     */
    @Suppress("LongParameterList")
    public suspend fun publishDrawEvent(
        drawId: String,
        playerId: String,
        playerNickname: String,
        playerAvatarUrl: String?,
        campaignId: String,
        campaignTitle: String,
        campaignType: CampaignType,
        prizeGrade: String,
        prizeName: String,
        prizePhotoUrl: String?,
        drawnAt: Instant,
        pityTriggered: Boolean = false,
    ): Unit =
        publishDrawEvent(
            DrawFeedEvent(
                drawId = drawId,
                playerId = playerId,
                playerNickname = playerNickname,
                playerAvatarUrl = playerAvatarUrl,
                campaignId = campaignId,
                campaignTitle = campaignTitle,
                campaignType = campaignType,
                prizeGrade = prizeGrade,
                prizeName = prizeName,
                prizePhotoUrl = prizePhotoUrl,
                drawnAt = drawnAt,
                pityTriggered = pityTriggered,
            ),
        )

    /**
     * Persists the draw result to feed_events then broadcasts it to the live feed channel.
     *
     * @param event The draw feed event to persist and broadcast.
     */
    @Suppress("TooGenericExceptionCaught")
    public suspend fun publishDrawEvent(event: DrawFeedEvent) {
        try {
            val feedEvent =
                FeedEvent(
                    id = UUID.randomUUID(),
                    drawId = event.drawId,
                    playerId = UUID.fromString(event.playerId),
                    playerNickname = event.playerNickname,
                    playerAvatarUrl = event.playerAvatarUrl,
                    campaignId = UUID.fromString(event.campaignId),
                    campaignTitle = event.campaignTitle,
                    campaignType = event.campaignType,
                    prizeGrade = event.prizeGrade,
                    prizeName = event.prizeName,
                    prizePhotoUrl = event.prizePhotoUrl,
                    drawnAt = event.drawnAt,
                    createdAt = Clock.System.now(),
                )
            feedEventRepository.save(feedEvent)

            val dto =
                DrawFeedEventDto(
                    drawId = event.drawId,
                    playerId = event.playerId,
                    playerNickname = event.playerNickname,
                    playerAvatarUrl = event.playerAvatarUrl,
                    campaignId = event.campaignId,
                    campaignTitle = event.campaignTitle,
                    campaignType = event.campaignType,
                    prizeGrade = event.prizeGrade,
                    prizeName = event.prizeName,
                    prizePhotoUrl = event.prizePhotoUrl,
                    drawnAt = event.drawnAt,
                    pityTriggered = event.pityTriggered,
                )
            val json = Json.encodeToString(DrawFeedEventDto.serializer(), dto)
            val envelope = """{"type":"feed_event","data":$json}"""
            pubSub.publish(CHANNEL, envelope)
        } catch (ex: Exception) {
            log.warn("Failed to publish feed event for draw ${event.drawId}: ${ex.message}")
        }
    }

    /**
     * Returns the most recent draw events for the REST initial-load endpoint.
     *
     * @param limit Maximum number of events to return.
     * @return [DrawFeedEventDto] list ordered newest-first.
     */
    public suspend fun getRecentEvents(limit: Int): List<DrawFeedEventDto> =
        feedEventRepository.findRecent(limit).map { event ->
            DrawFeedEventDto(
                drawId = event.drawId,
                playerId = event.playerId.toString(),
                playerNickname = event.playerNickname,
                playerAvatarUrl = event.playerAvatarUrl,
                campaignId = event.campaignId.toString(),
                campaignTitle = event.campaignTitle,
                campaignType = event.campaignType,
                prizeGrade = event.prizeGrade,
                prizeName = event.prizeName,
                prizePhotoUrl = event.prizePhotoUrl,
                drawnAt = event.drawnAt,
            )
        }

    private companion object {
        const val CHANNEL = "feed:draws"
    }
}
