package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.IUpdateCampaignUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.UnlimitedCampaign
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/**
 * Updates editable metadata fields on a campaign.
 *
 * For ACTIVE kuji campaigns the ticket grid is locked; only [title], [description], and
 * [coverImageUrl] may be changed. Structural fields (price, session duration) are immutable
 * once active to preserve player fairness.
 *
 * For unlimited campaigns [confirmProbabilityUpdate] must be true to indicate that the admin
 * is aware that probability changes take effect immediately for ongoing draws.
 */
public class UpdateCampaignUseCase(
    private val campaignRepository: ICampaignRepository,
    private val auditRepository: IAuditRepository,
) : IUpdateCampaignUseCase {
    override suspend fun execute(
        staffId: StaffId,
        campaignId: CampaignId,
        campaignType: CampaignType,
        title: String?,
        description: String?,
        coverImageUrl: String?,
        confirmProbabilityUpdate: Boolean,
    ) {
        when (campaignType) {
            CampaignType.KUJI -> updateKuji(staffId, campaignId, title, description, coverImageUrl)
            CampaignType.UNLIMITED ->
                updateUnlimited(staffId, campaignId, title, description, coverImageUrl, confirmProbabilityUpdate)
        }
    }

    private suspend fun updateKuji(
        staffId: StaffId,
        campaignId: CampaignId,
        title: String?,
        description: String?,
        coverImageUrl: String?,
    ) {
        val campaign =
            campaignRepository.findKujiById(campaignId)
                ?: throw AdminCampaignNotFoundException(campaignId.value.toString())
        val updated = applyKujiEdits(campaign, title, description, coverImageUrl)
        campaignRepository.saveKuji(updated)
        recordKujiAudit(staffId, campaign, updated)
    }

    private fun applyKujiEdits(
        campaign: KujiCampaign,
        title: String?,
        description: String?,
        coverImageUrl: String?,
    ): KujiCampaign {
        val now = Clock.System.now()
        return campaign.copy(
            title = title?.takeIf { it.isNotBlank() }?.trim() ?: campaign.title,
            description = description ?: campaign.description,
            coverImageUrl = coverImageUrl ?: campaign.coverImageUrl,
            updatedAt = now,
        )
    }

    private suspend fun updateUnlimited(
        staffId: StaffId,
        campaignId: CampaignId,
        title: String?,
        description: String?,
        coverImageUrl: String?,
        confirmProbabilityUpdate: Boolean,
    ) {
        val campaign =
            campaignRepository.findUnlimitedById(campaignId)
                ?: throw AdminCampaignNotFoundException(campaignId.value.toString())
        if (campaign.status == CampaignStatus.ACTIVE) {
            require(confirmProbabilityUpdate) {
                "Set confirmProbabilityUpdate=true to update an active unlimited campaign."
            }
        }
        val updated = applyUnlimitedEdits(campaign, title, description, coverImageUrl)
        campaignRepository.saveUnlimited(updated)
        recordUnlimitedAudit(staffId, campaign, updated)
    }

    private fun applyUnlimitedEdits(
        campaign: UnlimitedCampaign,
        title: String?,
        description: String?,
        coverImageUrl: String?,
    ): UnlimitedCampaign {
        val now = Clock.System.now()
        return campaign.copy(
            title = title?.takeIf { it.isNotBlank() }?.trim() ?: campaign.title,
            description = description ?: campaign.description,
            coverImageUrl = coverImageUrl ?: campaign.coverImageUrl,
            updatedAt = now,
        )
    }

    private fun recordKujiAudit(
        staffId: StaffId,
        before: KujiCampaign,
        after: KujiCampaign,
    ) {
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = staffId.value,
                action = "campaign.kuji.updated",
                entityType = "KujiCampaign",
                entityId = before.id.value,
                beforeValue = buildJsonObject { put("title", before.title) },
                afterValue = buildJsonObject { put("title", after.title) },
                metadata = buildJsonObject { put("staffId", staffId.value.toString()) },
                createdAt = Clock.System.now(),
            ),
        )
    }

    private fun recordUnlimitedAudit(
        staffId: StaffId,
        before: UnlimitedCampaign,
        after: UnlimitedCampaign,
    ) {
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = staffId.value,
                action = "campaign.unlimited.updated",
                entityType = "UnlimitedCampaign",
                entityId = before.id.value,
                beforeValue = buildJsonObject { put("title", before.title) },
                afterValue = buildJsonObject { put("title", after.title) },
                metadata = buildJsonObject { put("staffId", staffId.value.toString()) },
                createdAt = Clock.System.now(),
            ),
        )
    }
}
