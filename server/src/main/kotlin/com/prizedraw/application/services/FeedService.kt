package com.prizedraw.application.services

import com.prizedraw.application.ports.output.IPubSubService
import com.prizedraw.contracts.dto.feed.DrawFeedEventDto
import com.prizedraw.contracts.enums.CampaignType
import kotlinx.datetime.Instant
import kotlinx.serialization.json.Json
import org.slf4j.LoggerFactory

/**
 * Application service that publishes draw results to the live feed Redis channel.
 *
 * Each completed draw triggers [publishDrawEvent], which serialises a [DrawFeedEventDto]
 * into a JSON envelope and broadcasts it to all subscribers on the `feed:draws` channel.
 * The call is fire-and-forget: failures are logged at WARN level but never propagate to
 * the caller, ensuring feed publishing never blocks or rolls back a draw transaction.
 *
 * @param pubSub Output port for Redis pub/sub publishing.
 */
public class FeedService(
    private val pubSub: IPubSubService,
) {
    private val log = LoggerFactory.getLogger(FeedService::class.java)

    /**
     * All fields needed to describe a draw result for the live feed.
     *
     * Grouping into a single value type keeps [publishDrawEvent] below the
     * detekt [LongParameterList] threshold while preserving named-argument clarity
     * at call sites.
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
    )

    /**
     * Serialises the draw result into a feed event envelope and publishes it to [CHANNEL].
     *
     * The envelope format is `{"type":"feed_event","data":<DrawFeedEventDto JSON>}`.
     * Failures are swallowed and logged; this method never throws.
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
     */
    @Suppress("LongParameterList") // mirrors DrawFeedEvent fields; delegates immediately to the typed overload
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
    ): Unit = publishDrawEvent(
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
        ),
    )

    /**
     * Publishes a pre-assembled [DrawFeedEvent] to the live feed channel.
     *
     * Prefer calling this overload when the event fields are already grouped,
     * e.g. in batch or retry scenarios.
     *
     * @param event The draw feed event to broadcast.
     */
    @Suppress("TooGenericExceptionCaught") // fire-and-forget: all publish failures are non-fatal
    public suspend fun publishDrawEvent(event: DrawFeedEvent) {
        try {
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
                )
            val json = Json.encodeToString(DrawFeedEventDto.serializer(), dto)
            val envelope = """{"type":"feed_event","data":$json}"""
            pubSub.publish(CHANNEL, envelope)
        } catch (ex: Exception) {
            log.warn("Failed to publish feed event for draw ${event.drawId}: ${ex.message}")
        }
    }

    private companion object {
        const val CHANNEL = "feed:draws"
    }
}
