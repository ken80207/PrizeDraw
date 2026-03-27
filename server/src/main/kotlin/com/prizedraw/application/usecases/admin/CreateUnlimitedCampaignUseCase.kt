package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.ICreateUnlimitedCampaignUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.ISystemSettingsRepository
import com.prizedraw.contracts.dto.admin.UnlimitedPrizeEntryRequest
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.PrizeDefinition
import com.prizedraw.domain.entities.UnlimitedCampaign
import com.prizedraw.domain.services.MarginResult
import com.prizedraw.domain.services.MarginRiskService
import com.prizedraw.domain.services.UnlimitedPrizeInput
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
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
    private val prizeRepository: IPrizeRepository,
    private val marginRiskService: MarginRiskService,
    private val settingsRepository: ISystemSettingsRepository,
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

    /**
     * Creates an [UnlimitedCampaign] and optionally seeds its prize table in one operation.
     *
     * If [prizeTable] is non-empty:
     * - Validates probability sum == 1,000,000 bps.
     * - Validates each entry: prizeValue >= 0, probabilityBps > 0, grade/name not blank.
     * - Creates [PrizeDefinition] records for each entry.
     * - Calculates and returns margin via [MarginRiskService].
     *
     * If [prizeTable] is empty, no prize definitions are created and null is returned for
     * [MarginResult].
     *
     * @param staffId The staff member creating the campaign.
     * @param title Campaign display name.
     * @param description Optional rich-text description.
     * @param coverImageUrl Optional CDN URL for cover art.
     * @param pricePerDraw Draw points cost per single draw. Must be > 0.
     * @param rateLimitPerSecond Maximum draws per second per player. Must be >= 1.
     * @param prizeTable Optional initial prize probability table.
     * @return Pair of the created campaign and optional margin result.
     */
    public suspend fun executeWithPrizeTable(
        staffId: StaffId,
        title: String,
        description: String?,
        coverImageUrl: String?,
        pricePerDraw: Int,
        rateLimitPerSecond: Int,
        prizeTable: List<UnlimitedPrizeEntryRequest>,
    ): Pair<UnlimitedCampaign, MarginResult?> {
        val campaign = execute(staffId, title, description, coverImageUrl, pricePerDraw, rateLimitPerSecond)

        if (prizeTable.isEmpty()) {
            return campaign to null
        }

        val totalBps = prizeTable.sumOf { it.probabilityBps }
        require(totalBps == 1_000_000) {
            "Probability sum must be exactly 1,000,000 bps (100%), got: $totalBps"
        }

        prizeTable.forEach { entry ->
            require(entry.prizeValue >= 0) { "prizeValue must be >= 0" }
            require(entry.probabilityBps > 0) { "probabilityBps must be > 0" }
            require(entry.grade.isNotBlank()) { "grade must not be blank" }
            require(entry.name.isNotBlank()) { "name must not be blank" }
        }

        val now = Clock.System.now()
        val definitions = prizeTable.map { entry ->
            PrizeDefinition(
                id = PrizeDefinitionId.generate(),
                kujiCampaignId = null,
                unlimitedCampaignId = campaign.id,
                grade = entry.grade,
                name = entry.name,
                photos = listOfNotNull(entry.photoUrl),
                prizeValue = entry.prizeValue,
                buybackPrice = 0,
                buybackEnabled = true,
                probabilityBps = entry.probabilityBps,
                ticketCount = null,
                displayOrder = entry.displayOrder,
                createdAt = now,
                updatedAt = now,
            )
        }
        prizeRepository.saveAll(definitions)

        val threshold = settingsRepository.getMarginThresholdPct()
        val marginResult = marginRiskService.calculateUnlimitedMargin(
            pricePerDraw = campaign.pricePerDraw,
            prizes = definitions.map {
                UnlimitedPrizeInput(
                    probabilityBps = it.probabilityBps!!,
                    prizeValue = it.prizeValue,
                )
            },
            thresholdPct = threshold,
        )

        return campaign to marginResult
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
