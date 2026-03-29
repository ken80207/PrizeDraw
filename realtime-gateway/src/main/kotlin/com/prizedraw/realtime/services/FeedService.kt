package com.prizedraw.realtime.services

import com.prizedraw.contracts.dto.feed.DrawFeedEventDto
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.FeedEvent
import com.prizedraw.realtime.infrastructure.redis.RedisPubSub
import com.prizedraw.realtime.ports.IFeedEventRepository
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Application service that publishes draw results to the live feed Redis channel and
 * persists them to the denormalised feed_events table.
 *
 * Each completed draw triggers [publishDrawEvent], which:
 * 1. Saves a [FeedEvent] row to the database.
 * 2. Serialises a [DrawFeedEventDto] envelope and broadcasts it on the `feed:draws` channel.
 *
 * Both steps are fire-and-forget: failures are logged at WARN level but never propagate to
 * the caller, ensuring feed publishing never blocks or rolls back a draw transaction.
 *
 * @param pubSub Pub/sub bus for Redis publishing.
 * @param feedEventRepository Persistence port for feed events.
 */
public class FeedService(
    private val pubSub: RedisPubSub,
    private val feedEventRepository: IFeedEventRepository,
) {
    private val log = LoggerFactory.getLogger(FeedService::class.java)

    /**
     * All fields needed to describe a draw result for the live feed.
     *
     * @param drawId Unique identifier of the draw result.
     * @param playerId Identifier of the player who drew.
     * @param playerNickname Display name of the player at draw time.
     * @param playerAvatarUrl URL of the player's avatar, or null if not set.
     * @param campaignId Identifier of the campaign the draw belongs to.
     * @param campaignTitle Human-readable campaign title.
     * @param campaignType Whether the campaign is KUJI or UNLIMITED.
     * @param prizeGrade Grade label of the prize won (e.g. "A", "Last").
     * @param prizeName Display name of the prize won.
     * @param prizePhotoUrl URL of the prize photo, or null if not available.
     * @param drawnAt Server-side timestamp of when the draw occurred.
     * @param pityTriggered Whether this draw was guaranteed by the pity system.
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
     * Persists the draw result to feed_events then broadcasts it to the live feed channel.
     *
     * Failures are swallowed and logged; this method never throws.
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
