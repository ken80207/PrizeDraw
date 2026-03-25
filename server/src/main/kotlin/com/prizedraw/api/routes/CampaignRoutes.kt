package com.prizedraw.api.routes

import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IDrawRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.contracts.dto.campaign.KujiCampaignDetailDto
import com.prizedraw.contracts.dto.campaign.KujiCampaignDto
import com.prizedraw.contracts.dto.campaign.PrizeDefinitionDto
import com.prizedraw.contracts.dto.campaign.TicketBoxDto
import com.prizedraw.contracts.dto.campaign.UnlimitedCampaignDetailDto
import com.prizedraw.contracts.dto.campaign.UnlimitedCampaignDto
import com.prizedraw.contracts.dto.draw.DrawTicketDto
import com.prizedraw.contracts.endpoints.AdminEndpoints
import com.prizedraw.contracts.endpoints.CampaignEndpoints
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.domain.entities.DrawTicketStatus
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.entities.UnlimitedCampaign
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.infrastructure.websocket.ConnectionManager
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.RoutingContext
import io.ktor.server.routing.get
import org.koin.ktor.ext.inject
import java.util.UUID

/**
 * Registers kuji and unlimited campaign query routes.
 *
 * - GET [CampaignEndpoints.KUJI_LIST]         -- List active kuji campaigns.
 * - GET [CampaignEndpoints.KUJI_BY_ID]        -- Campaign detail with boxes and prizes.
 * - GET [CampaignEndpoints.KUJI_TICKET_BOARD] -- Full ticket board for a specific box.
 * - GET [CampaignEndpoints.UNLIMITED_LIST]    -- List active unlimited campaigns.
 * - GET [CampaignEndpoints.UNLIMITED_BY_ID]   -- Unlimited campaign detail with prize table.
 * - GET [AdminEndpoints.SPECTATOR_COUNT]      -- Spectator (viewer) count for a kuji campaign.
 */
public fun Route.campaignRoutes() {
    val campaignRepository: ICampaignRepository by inject()
    val ticketBoxRepository: ITicketBoxRepository by inject()
    val prizeRepository: IPrizeRepository by inject()
    val drawRepository: IDrawRepository by inject()
    val connectionManager: ConnectionManager by inject()

    get(CampaignEndpoints.KUJI_LIST) {
        val campaigns = campaignRepository.findActiveKujiCampaigns()
        call.respond(HttpStatusCode.OK, campaigns.map { it.toDto() })
    }

    get(CampaignEndpoints.KUJI_BY_ID) {
        handleKujiCampaignDetail(campaignRepository, ticketBoxRepository, prizeRepository)
    }

    get(CampaignEndpoints.KUJI_TICKET_BOARD) {
        val boxId = call.parseUuidParam("boxId") ?: return@get
        call.respond(HttpStatusCode.OK, buildTicketBoard(boxId, drawRepository, prizeRepository))
    }

    get(CampaignEndpoints.UNLIMITED_LIST) {
        val campaigns = campaignRepository.findActiveUnlimitedCampaigns()
        call.respond(HttpStatusCode.OK, campaigns.map { it.toDto() })
    }

    get(AdminEndpoints.SPECTATOR_COUNT) {
        val campaignId = call.parseUuidParam("campaignId") ?: return@get
        val roomKey = "kuji:$campaignId"
        val count = connectionManager.spectatorCount(roomKey)
        call.respond(HttpStatusCode.OK, mapOf("campaignId" to campaignId.toString(), "spectatorCount" to count))
    }

    get(CampaignEndpoints.UNLIMITED_BY_ID) {
        handleUnlimitedCampaignDetail(campaignRepository, prizeRepository)
    }
}

private suspend fun RoutingContext.handleKujiCampaignDetail(
    campaignRepository: ICampaignRepository,
    ticketBoxRepository: ITicketBoxRepository,
    prizeRepository: IPrizeRepository,
) {
    val campaignId = call.parseUuidParam("campaignId") ?: return
    val campaign =
        campaignRepository.findKujiById(CampaignId(campaignId)) ?: run {
            call.respond(HttpStatusCode.NotFound, mapOf("error" to "Campaign not found"))
            return
        }
    val boxes = ticketBoxRepository.findByCampaignId(CampaignId(campaignId))
    val prizes = prizeRepository.findDefinitionsByCampaign(CampaignId(campaignId), CampaignType.KUJI)
    call.respond(
        HttpStatusCode.OK,
        KujiCampaignDetailDto(
            campaign = campaign.toDto(),
            boxes = boxes.map { it.toDto() },
            prizes = prizes.map { it.toDto() },
        ),
    )
}

private suspend fun RoutingContext.handleUnlimitedCampaignDetail(
    campaignRepository: ICampaignRepository,
    prizeRepository: IPrizeRepository,
) {
    val campaignId = call.parseUuidParam("campaignId") ?: return
    val campaign =
        campaignRepository.findUnlimitedById(CampaignId(campaignId)) ?: run {
            call.respond(HttpStatusCode.NotFound, mapOf("error" to "Campaign not found"))
            return
        }
    val prizes =
        prizeRepository.findDefinitionsByCampaign(
            CampaignId(campaignId),
            CampaignType.UNLIMITED,
        )
    call.respond(
        HttpStatusCode.OK,
        UnlimitedCampaignDetailDto(
            campaign = campaign.toDto(),
            prizes = prizes.map { it.toDto() },
        ),
    )
}

private suspend fun io.ktor.server.application.ApplicationCall.parseUuidParam(name: String): UUID? {
    val raw =
        parameters[name] ?: run {
            respond(HttpStatusCode.BadRequest, mapOf("error" to "Missing $name"))
            return null
        }
    return runCatching { UUID.fromString(raw) }.getOrElse {
        respond(HttpStatusCode.BadRequest, mapOf("error" to "Invalid $name"))
        null
    }
}

private suspend fun buildTicketBoard(
    boxId: UUID,
    drawRepository: IDrawRepository,
    prizeRepository: IPrizeRepository,
): List<DrawTicketDto> {
    val tickets = drawRepository.findTicketsByBox(boxId)
    val prizeDefIds = tickets.map { it.prizeDefinitionId }.toSet()
    val prizeDefsMap =
        prizeDefIds
            .mapNotNull { prizeRepository.findDefinitionById(it) }
            .associateBy { it.id }
    return tickets.map { ticket ->
        val def = prizeDefsMap[ticket.prizeDefinitionId]
        val isDrawn = ticket.status == DrawTicketStatus.DRAWN
        DrawTicketDto(
            id = ticket.id.toString(),
            position = ticket.position,
            status = PrizeState.HOLDING,
            drawnByPlayerId = ticket.drawnByPlayerId?.value?.toString(),
            drawnByNickname = null,
            drawnAt = ticket.drawnAt,
            prizeDefinitionId = ticket.prizeDefinitionId.value.toString(),
            grade =
                if (isDrawn) {
                    def?.grade
                } else {
                    null
                },
            prizeName =
                if (isDrawn) {
                    def?.name
                } else {
                    null
                },
            prizePhotoUrl =
                if (isDrawn) {
                    def?.photos?.firstOrNull()
                } else {
                    null
                },
        )
    }
}

// --- Mapping helpers ---

private fun KujiCampaign.toDto(): KujiCampaignDto =
    KujiCampaignDto(
        id = id.value.toString(),
        title = title,
        description = description,
        coverImageUrl = coverImageUrl,
        pricePerDraw = pricePerDraw,
        drawSessionSeconds = drawSessionSeconds,
        status = status,
        activatedAt = activatedAt,
        soldOutAt = soldOutAt,
    )

private fun TicketBox.toDto(): TicketBoxDto =
    TicketBoxDto(
        id = id.toString(),
        name = name,
        totalTickets = totalTickets,
        remainingTickets = remainingTickets,
        status =
            com.prizedraw.contracts.enums.TicketBoxStatus
                .valueOf(status.name),
        displayOrder = displayOrder,
    )

private fun PrizeDefinition.toDto(): PrizeDefinitionDto =
    PrizeDefinitionDto(
        id = id.value.toString(),
        grade = grade,
        name = name,
        photos = photos,
        buybackPrice = buybackPrice,
        buybackEnabled = buybackEnabled,
        probabilityBps = probabilityBps,
        ticketCount = ticketCount,
        displayOrder = displayOrder,
    )

private fun UnlimitedCampaign.toDto(): UnlimitedCampaignDto =
    UnlimitedCampaignDto(
        id = id.value.toString(),
        title = title,
        description = description,
        coverImageUrl = coverImageUrl,
        pricePerDraw = pricePerDraw,
        rateLimitPerSecond = rateLimitPerSecond,
        status = status,
        activatedAt = activatedAt,
    )
