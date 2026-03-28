package com.prizedraw.application.usecases.admin

import com.prizedraw.application.events.FavoriteCampaignRestocked
import com.prizedraw.application.ports.input.admin.IAddTicketBoxUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignFavoriteRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.INotificationRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.contracts.dto.admin.CreateKujiBoxRequest
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.Notification
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
 * Adds one or more new ticket boxes to an existing KUJI campaign (restock).
 *
 * When the campaign is [CampaignStatus.SOLD_OUT], this use case transitions it back to
 * [CampaignStatus.ACTIVE] and notifies all favoriting players via push notification and the
 * outbox pattern.
 *
 * Validates:
 * - Campaign must exist and be in [CampaignStatus.ACTIVE] or [CampaignStatus.SOLD_OUT].
 * - [boxes] must not be empty.
 *
 * Box [TicketBox.displayOrder] continues from the highest existing box order + 1.
 * Prize [PrizeDefinition.displayOrder] continues from the highest existing prize order + 1.
 */
@Suppress("LongParameterList")
public class AddTicketBoxUseCase(
    private val campaignRepository: ICampaignRepository,
    private val ticketBoxRepository: ITicketBoxRepository,
    private val prizeRepository: IPrizeRepository,
    private val auditRepository: IAuditRepository,
    private val favoriteRepo: ICampaignFavoriteRepository,
    private val notificationRepo: INotificationRepository,
    private val outboxRepo: IOutboxRepository,
) : IAddTicketBoxUseCase {
    override suspend fun execute(
        staffId: StaffId,
        campaignId: CampaignId,
        boxes: List<CreateKujiBoxRequest>,
    ): List<TicketBox> {
        require(boxes.isNotEmpty()) { "boxes must not be empty" }

        val campaign =
            campaignRepository.findKujiById(campaignId)
                ?: throw AdminCampaignNotFoundException(campaignId.value.toString())

        require(campaign.status == CampaignStatus.ACTIVE || campaign.status == CampaignStatus.SOLD_OUT) {
            "Cannot add ticket boxes to a campaign in ${campaign.status} status. " +
                "Only ACTIVE or SOLD_OUT campaigns can be restocked."
        }

        val wasSoldOut = campaign.status == CampaignStatus.SOLD_OUT
        val now = Clock.System.now()

        val createdBoxes = createBoxesAndPrizes(campaignId, boxes, now)

        if (wasSoldOut) {
            handleRestock(campaign, campaignId, now)
        }

        recordAudit(staffId, campaignId, boxes.size, now)

        return createdBoxes
    }

    private suspend fun createBoxesAndPrizes(
        campaignId: CampaignId,
        boxes: List<CreateKujiBoxRequest>,
        now: kotlinx.datetime.Instant,
    ): List<TicketBox> {
        val existingBoxes = ticketBoxRepository.findByCampaignId(campaignId)
        val nextBoxOrder =
            if (existingBoxes.isEmpty()) {
                0
            } else {
                existingBoxes.maxOf { it.displayOrder } + 1
            }

        val existingPrizes = prizeRepository.findDefinitionsByCampaign(campaignId, CampaignType.KUJI)
        var prizeDisplayOrder =
            if (existingPrizes.isEmpty()) {
                0
            } else {
                existingPrizes.maxOf { it.displayOrder } + 1
            }

        val createdBoxes = mutableListOf<TicketBox>()
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
                    displayOrder = nextBoxOrder + boxIndex,
                    createdAt = now,
                    updatedAt = now,
                )
            val savedBox = ticketBoxRepository.save(ticketBox)
            createdBoxes.add(savedBox)
            savePrizeDefinitions(campaignId, boxReq, prizeDisplayOrder, now).also { count ->
                prizeDisplayOrder += count
            }
        }
        return createdBoxes
    }

    private suspend fun savePrizeDefinitions(
        campaignId: CampaignId,
        boxReq: CreateKujiBoxRequest,
        startDisplayOrder: Int,
        now: kotlinx.datetime.Instant,
    ): Int {
        var count = 0
        for (rangeReq in boxReq.ticketRanges) {
            val ticketCount = rangeReq.rangeEnd - rangeReq.rangeStart + 1
            require(ticketCount > 0) {
                "Invalid ticket range: ${rangeReq.rangeStart}-${rangeReq.rangeEnd}"
            }
            val prizeDefinition =
                PrizeDefinition(
                    id = PrizeDefinitionId(UUID.randomUUID()),
                    kujiCampaignId = campaignId,
                    unlimitedCampaignId = null,
                    grade = rangeReq.grade,
                    name = rangeReq.prizeName,
                    photos = listOfNotNull(rangeReq.photoUrl),
                    prizeValue = rangeReq.prizeValue,
                    buybackPrice = 0,
                    buybackEnabled = true,
                    probabilityBps = null,
                    ticketCount = ticketCount,
                    displayOrder = startDisplayOrder + count,
                    createdAt = now,
                    updatedAt = now,
                )
            prizeRepository.saveDefinition(prizeDefinition)
            count++
        }
        return count
    }

    private suspend fun handleRestock(
        campaign: KujiCampaign,
        campaignId: CampaignId,
        now: kotlinx.datetime.Instant,
    ) {
        val restockedCampaign =
            campaign.copy(
                status = CampaignStatus.ACTIVE,
                soldOutAt = null,
                lowStockNotifiedAt = null,
                updatedAt = now,
            )
        campaignRepository.saveKuji(restockedCampaign)
        notifyFavoritingPlayers(campaignId, campaign.title, now)
    }

    private suspend fun notifyFavoritingPlayers(
        campaignId: CampaignId,
        campaignTitle: String,
        now: kotlinx.datetime.Instant,
    ) {
        val playerIds = favoriteRepo.findPlayerIdsByCampaign(CampaignType.KUJI, campaignId)
        if (playerIds.isEmpty()) {
            return
        }

        val epochMillis = now.toEpochMilliseconds()
        val notifications =
            playerIds.map { playerId ->
                Notification(
                    playerId = playerId,
                    eventType = "favorite.campaign_restocked",
                    title = "收藏的活動已加開",
                    body = "你收藏的『$campaignTitle』已加開新箱，快來抽！",
                    data =
                        mapOf(
                            "campaignId" to campaignId.value.toString(),
                            "campaignType" to CampaignType.KUJI.name,
                        ),
                    dedupKey = "favorite.campaign_restocked:${campaignId.value}:$playerId:$epochMillis",
                )
            }
        notificationRepo.batchInsertIgnore(notifications)

        playerIds.forEach { playerId ->
            outboxRepo.enqueue(
                FavoriteCampaignRestocked(
                    campaignId = campaignId.value,
                    campaignType = CampaignType.KUJI.name,
                    campaignTitle = campaignTitle,
                    playerId = playerId,
                ),
            )
        }
    }

    private fun recordAudit(
        staffId: StaffId,
        campaignId: CampaignId,
        boxCount: Int,
        now: kotlinx.datetime.Instant,
    ) {
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = staffId.value,
                action = "campaign.kuji.boxes_added",
                entityType = "KujiCampaign",
                entityId = campaignId.value,
                beforeValue = null,
                afterValue =
                    buildJsonObject {
                        put("campaignId", campaignId.value.toString())
                        put("boxesAdded", boxCount)
                    },
                metadata = buildJsonObject { put("staffId", staffId.value.toString()) },
                createdAt = now,
            ),
        )
    }
}
