package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.ICreateUnlimitedCampaignUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.UnlimitedCampaign
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/**
 * Creates an [UnlimitedCampaign] in DRAFT status and records an audit log entry.
 *
 * Validates:
 * - [pricePerDraw] must be > 0.
 * - [rateLimitPerSecond] must be >= 1.
 *
 * Prize definitions with probabilities are added via separate admin operations.
 * Probability sum validation (== 1,000,000 bps) is enforced at publish time
 * by [UpdateCampaignStatusUseCase].
 */
public class CreateUnlimitedCampaignUseCase(
    private val campaignRepository: ICampaignRepository,
    private val auditRepository: IAuditRepository,
) : ICreateUnlimitedCampaignUseCase {
    override suspend fun execute(
        staffId: StaffId,
        title: String,
        description: String?,
        coverImageUrl: String?,
        pricePerDraw: Int,
        rateLimitPerSecond: Int,
    ): UnlimitedCampaign {
        require(pricePerDraw > 0) { "pricePerDraw must be > 0, got $pricePerDraw" }
        require(rateLimitPerSecond >= 1) { "rateLimitPerSecond must be >= 1, got $rateLimitPerSecond" }
        require(title.isNotBlank()) { "title must not be blank" }

        val now = Clock.System.now()
        val campaign =
            UnlimitedCampaign(
                id = CampaignId(UUID.randomUUID()),
                title = title.trim(),
                description = description,
                coverImageUrl = coverImageUrl,
                pricePerDraw = pricePerDraw,
                rateLimitPerSecond = rateLimitPerSecond,
                status = CampaignStatus.DRAFT,
                activatedAt = null,
                createdByStaffId = staffId.value,
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
            )

        val saved = campaignRepository.saveUnlimited(campaign)
        recordAudit(staffId, saved, now)
        return saved
    }

    private fun recordAudit(
        staffId: StaffId,
        campaign: UnlimitedCampaign,
        now: kotlinx.datetime.Instant,
    ) {
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = staffId.value,
                action = "campaign.unlimited.created",
                entityType = "UnlimitedCampaign",
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
