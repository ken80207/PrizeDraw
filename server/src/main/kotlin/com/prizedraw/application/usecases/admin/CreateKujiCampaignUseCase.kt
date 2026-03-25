package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.ICreateKujiCampaignUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.valueobjects.CampaignId
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
 * The campaign starts with no ticket boxes; boxes and prize definitions are added
 * via separate admin operations before the campaign is published.
 */
public class CreateKujiCampaignUseCase(
    private val campaignRepository: ICampaignRepository,
    private val auditRepository: IAuditRepository,
) : ICreateKujiCampaignUseCase {
    override suspend fun execute(
        staffId: StaffId,
        title: String,
        description: String?,
        coverImageUrl: String?,
        pricePerDraw: Int,
        drawSessionSeconds: Int,
    ): KujiCampaign {
        require(pricePerDraw > 0) { "pricePerDraw must be > 0, got $pricePerDraw" }
        require(drawSessionSeconds > 0) { "drawSessionSeconds must be > 0, got $drawSessionSeconds" }
        require(title.isNotBlank()) { "title must not be blank" }

        val now = Clock.System.now()
        val campaign =
            KujiCampaign(
                id = CampaignId(UUID.randomUUID()),
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
