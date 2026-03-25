package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.IUpdateCampaignStatusUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ITicketBoxRepository
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

private const val PROBABILITY_SUM_TARGET = 1_000_000

/**
 * Handles campaign lifecycle transitions with validation.
 *
 * Permitted transitions:
 * - DRAFT → ACTIVE: validates campaign readiness; for kuji locks ticket grid.
 * - ACTIVE → SUSPENDED: suspends an active campaign.
 * - SUSPENDED → ACTIVE: reactivates a suspended campaign.
 *
 * For unlimited DRAFT → ACTIVE, validates that `SUM(probabilityBps) == 1,000,000`.
 */
public class UpdateCampaignStatusUseCase(
    private val campaignRepository: ICampaignRepository,
    private val ticketBoxRepository: ITicketBoxRepository,
    private val prizeRepository: IPrizeRepository,
    private val auditRepository: IAuditRepository,
) : IUpdateCampaignStatusUseCase {
    override suspend fun execute(
        staffId: StaffId,
        campaignId: CampaignId,
        campaignType: CampaignType,
        newStatus: CampaignStatus,
    ) {
        val currentStatus = resolveCurrentStatus(campaignId, campaignType)
        validateTransition(currentStatus, newStatus)

        when (campaignType) {
            CampaignType.KUJI -> activateKujiIfNeeded(campaignId, newStatus)
            CampaignType.UNLIMITED -> activateUnlimitedIfNeeded(campaignId, newStatus)
        }

        applyStatusChange(campaignId, campaignType, newStatus)
        recordAudit(staffId, campaignId, campaignType, currentStatus, newStatus)
    }

    private suspend fun resolveCurrentStatus(
        campaignId: CampaignId,
        campaignType: CampaignType,
    ): CampaignStatus =
        when (campaignType) {
            CampaignType.KUJI ->
                campaignRepository
                    .findKujiById(campaignId)
                    ?.status
                    ?: throw AdminCampaignNotFoundException(campaignId.value.toString())
            CampaignType.UNLIMITED ->
                campaignRepository
                    .findUnlimitedById(campaignId)
                    ?.status
                    ?: throw AdminCampaignNotFoundException(campaignId.value.toString())
        }

    private fun validateTransition(
        current: CampaignStatus,
        requested: CampaignStatus,
    ) {
        val allowed =
            when (current) {
                CampaignStatus.DRAFT -> setOf(CampaignStatus.ACTIVE)
                CampaignStatus.ACTIVE -> setOf(CampaignStatus.SUSPENDED)
                CampaignStatus.SUSPENDED -> setOf(CampaignStatus.ACTIVE)
                CampaignStatus.SOLD_OUT -> emptySet()
            }
        if (requested !in allowed) {
            throw InvalidCampaignTransitionException(current, requested)
        }
    }

    private suspend fun activateKujiIfNeeded(
        campaignId: CampaignId,
        newStatus: CampaignStatus,
    ) {
        if (newStatus != CampaignStatus.ACTIVE) {
            return
        }
        val boxes = ticketBoxRepository.findByCampaignId(campaignId)
        require(boxes.isNotEmpty()) {
            "Kuji campaign ${campaignId.value} has no ticket boxes; cannot activate."
        }
        // Each box must have at least one prize definition with a photo
        boxes.forEach { box ->
            val prizes = prizeRepository.findDefinitionsByCampaign(campaignId, CampaignType.KUJI)
            require(prizes.isNotEmpty()) {
                "Ticket box ${box.id} in campaign ${campaignId.value} has no prize definitions."
            }
            require(prizes.all { it.photos.isNotEmpty() }) {
                "All prize definitions in campaign ${campaignId.value} must have at least one photo."
            }
        }
    }

    private suspend fun activateUnlimitedIfNeeded(
        campaignId: CampaignId,
        newStatus: CampaignStatus,
    ) {
        if (newStatus != CampaignStatus.ACTIVE) {
            return
        }
        val prizes = prizeRepository.findDefinitionsByCampaign(campaignId, CampaignType.UNLIMITED)
        require(prizes.isNotEmpty()) {
            "Unlimited campaign ${campaignId.value} has no prize definitions; cannot activate."
        }
        val sum = prizes.sumOf { it.probabilityBps ?: 0 }
        require(sum == PROBABILITY_SUM_TARGET) {
            "Unlimited campaign ${campaignId.value}: probability sum must be $PROBABILITY_SUM_TARGET bps, got $sum."
        }
        require(prizes.all { it.photos.isNotEmpty() }) {
            "All prize definitions in campaign ${campaignId.value} must have at least one photo."
        }
    }

    private suspend fun applyStatusChange(
        campaignId: CampaignId,
        campaignType: CampaignType,
        newStatus: CampaignStatus,
    ) {
        when (campaignType) {
            CampaignType.KUJI -> campaignRepository.updateKujiStatus(campaignId, newStatus)
            CampaignType.UNLIMITED -> campaignRepository.updateUnlimitedStatus(campaignId, newStatus)
        }
    }

    private fun recordAudit(
        staffId: StaffId,
        campaignId: CampaignId,
        campaignType: CampaignType,
        oldStatus: CampaignStatus,
        newStatus: CampaignStatus,
    ) {
        val now = Clock.System.now()
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = staffId.value,
                action = "campaign.status.changed",
                entityType = campaignType.name.lowercase().replaceFirstChar { it.uppercase() } + "Campaign",
                entityId = campaignId.value,
                beforeValue = buildJsonObject { put("status", oldStatus.name) },
                afterValue = buildJsonObject { put("status", newStatus.name) },
                metadata =
                    buildJsonObject {
                        put("staffId", staffId.value.toString())
                        put("campaignType", campaignType.name)
                    },
                createdAt = now,
            ),
        )
    }
}
