package com.prizedraw.api.routes

import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IDrawRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.contracts.dto.feed.DrawFeedEventDto
import com.prizedraw.contracts.dto.feed.FeedRecentResponse
import com.prizedraw.contracts.endpoints.FeedEndpoints
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import io.ktor.http.HttpStatusCode
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import org.koin.ktor.ext.inject

private const val MAX_FEED_LIMIT = 100
private const val DEFAULT_FEED_LIMIT = 50

/**
 * Public REST endpoint for the live draw feed.
 *
 * `GET /api/v1/feed/recent` returns the most recently drawn tickets as
 * [DrawFeedEventDto] items, enriched with player, campaign, and prize data.
 * The `limit` query parameter controls result count (default 50, max 100).
 *
 * No authentication is required. Tickets that cannot be fully resolved
 * (missing player, prize definition, or campaign) are silently omitted.
 */
public fun Route.feedRoutes() {
    val drawRepository: IDrawRepository by inject()
    val prizeRepository: IPrizeRepository by inject()
    val campaignRepository: ICampaignRepository by inject()
    val playerRepository: IPlayerRepository by inject()
    val ticketBoxRepository: ITicketBoxRepository by inject()

    get(FeedEndpoints.RECENT) {
        val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: DEFAULT_FEED_LIMIT)
            .coerceIn(1, MAX_FEED_LIMIT)

        val recentTickets = drawRepository.findRecentDrawn(limit)

        val items = recentTickets.mapNotNull { ticket ->
            // Resolve prize definition (required)
            val prizeDef = prizeRepository.findDefinitionById(
                PrizeDefinitionId(ticket.prizeDefinitionId.value),
            ) ?: return@mapNotNull null

            // Resolve the player who drew the ticket (required)
            val playerId = ticket.drawnByPlayerId ?: return@mapNotNull null
            val player = playerRepository.findById(playerId) ?: return@mapNotNull null

            // Resolve campaign via the parent ticket box (draw_tickets → ticket_boxes → kuji_campaigns)
            val ticketBox = ticketBoxRepository.findById(ticket.ticketBoxId)
                ?: return@mapNotNull null
            val campaignId = ticketBox.kujiCampaignId

            // All draw tickets belong to kuji campaigns — look up the kuji campaign for title
            val campaign = campaignRepository.findKujiById(campaignId)
                ?: return@mapNotNull null

            DrawFeedEventDto(
                drawId = ticket.id.toString(),
                playerId = player.id.value.toString(),
                playerNickname = player.nickname,
                playerAvatarUrl = player.avatarUrl,
                campaignId = campaignId.value.toString(),
                campaignTitle = campaign.title,
                campaignType = CampaignType.KUJI,
                prizeGrade = prizeDef.grade,
                prizeName = prizeDef.name,
                prizePhotoUrl = prizeDef.photos.firstOrNull(),
                drawnAt = ticket.drawnAt ?: ticket.createdAt,
            )
        }

        call.respond(HttpStatusCode.OK, FeedRecentResponse(items = items))
    }
}
