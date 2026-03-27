package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.ICreateKujiCampaignUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.contracts.dto.admin.CreateKujiBoxRequest
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.TicketBox
import com.prizedraw.domain.entities.TicketBoxStatus
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/**
 * Creates a [KujiCampaign] in DRAFT status and records an audit log entry.
 *
 * Validates:
 * - [pricePerDraw] must be > 0.
 * - [drawSessionSeconds] must be > 0.
 *
 * Optionally creates ticket boxes and prize definitions atomically with the campaign.
 */
public class CreateKujiCampaignUseCase(
    private val campaignRepository: ICampaignRepository,
    private val ticketBoxRepository: ITicketBoxRepository,
    private val prizeRepository: IPrizeRepository,
    private val auditRepository: IAuditRepository,
) : ICreateKujiCampaignUseCase {
    override suspend fun execute(
        staffId: StaffId,
        title: String,
        description: String?,
        coverImageUrl: String?,
        pricePerDraw: Int,
        drawSessionSeconds: Int,
        boxes: List<CreateKujiBoxRequest>,
    ): KujiCampaign {
        require(pricePerDraw > 0) { "pricePerDraw must be > 0, got $pricePerDraw" }
        require(drawSessionSeconds > 0) { "drawSessionSeconds must be > 0, got $drawSessionSeconds" }
        require(title.isNotBlank()) { "title must not be blank" }

        val now = Clock.System.now()
        val campaignId = CampaignId(UUID.randomUUID())
        val campaign =
            KujiCampaign(
                id = campaignId,
                title = title.trim(),
                description = description,
                coverImageUrl = coverImageUrl,
                pricePerDraw = pricePerDraw,
                drawSessionSeconds = drawSessionSeconds,
                status = CampaignStatus.DRAFT,
                activatedAt = null,
                soldOutAt = null,
                createdByStaffId = staffId.value,
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
            )

        val saved = campaignRepository.saveKuji(campaign)

        // Create ticket boxes and prize definitions if provided
        var prizeDisplayOrder = 0
        for ((boxIndex, boxReq) in boxes.withIndex()) {
            val ticketBox =
                TicketBox(
                    id = UUID.randomUUID(),
                    kujiCampaignId = campaignId,
                    name = boxReq.name,
                    totalTickets = boxReq.totalTickets,
                    remainingTickets = boxReq.totalTickets,
                    status = TicketBoxStatus.AVAILABLE,
                    soldOutAt = null,
                    displayOrder = boxIndex,
                    createdAt = now,
                    updatedAt = now,
                )
            ticketBoxRepository.save(ticketBox)

            for (rangeReq in boxReq.ticketRanges) {
                val ticketCount = rangeReq.rangeEnd - rangeReq.rangeStart + 1
                require(ticketCount > 0) {
                    "Invalid ticket range: ${rangeReq.rangeStart}-${rangeReq.rangeEnd}"
                }

                val photos = listOfNotNull(rangeReq.photoUrl)
                val prizeDefinition =
                    PrizeDefinition(
                        id = PrizeDefinitionId(UUID.randomUUID()),
                        kujiCampaignId = campaignId,
                        unlimitedCampaignId = null,
                        grade = rangeReq.grade,
                        name = rangeReq.prizeName,
                        photos = photos,
                        prizeValue = rangeReq.prizeValue,
                        buybackPrice = 0,
                        buybackEnabled = true,
                        probabilityBps = null,
                        ticketCount = ticketCount,
                        displayOrder = prizeDisplayOrder++,
                        createdAt = now,
                        updatedAt = now,
                    )
                prizeRepository.saveDefinition(prizeDefinition)
            }
        }

        recordAudit(staffId, saved, now)
        return saved
    }

    private fun recordAudit(
        staffId: StaffId,
        campaign: KujiCampaign,
        now: kotlinx.datetime.Instant,
    ) {
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = staffId.value,
                action = "campaign.kuji.created",
                entityType = "KujiCampaign",
                entityId = campaign.id.value,
                beforeValue = null,
                afterValue =
                    buildJsonObject {
                        put("title", campaign.title)
                        put("status", campaign.status.name)
                        put("pricePerDraw", campaign.pricePerDraw)
                    },
                metadata = buildJsonObject { put("staffId", staffId.value.toString()) },
                createdAt = now,
            ),
        )
    }
}
