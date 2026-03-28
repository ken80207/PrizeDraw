package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.application.ports.output.IPityRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.contracts.dto.pity.PityPrizePoolItemDto
import com.prizedraw.contracts.dto.pity.PityRuleDto
import com.prizedraw.contracts.dto.pity.UpsertPityRuleRequest
import com.prizedraw.contracts.enums.CampaignType
import com.prizedraw.domain.entities.AccumulationMode
import com.prizedraw.domain.entities.PityPrizePoolEntry
import com.prizedraw.domain.entities.PityRule
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.domain.valueobjects.PrizeDefinitionId
import kotlinx.datetime.Clock
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/** Retrieves the pity rule for a campaign. */
public class GetPityRuleUseCase(
    private val pityRepository: IPityRepository,
    private val prizeRepository: IPrizeRepository,
) {
    /** Returns the pity rule DTO or null if no rule is configured. */
    public suspend fun execute(campaignId: UUID): PityRuleDto? {
        val rule = pityRepository.findRuleByCampaignId(CampaignId(campaignId)) ?: return null
        val pool = pityRepository.findPoolByRuleId(rule.id)
        return toDto(rule, pool)
    }

    private suspend fun toDto(
        rule: PityRule,
        pool: List<PityPrizePoolEntry>,
    ): PityRuleDto {
        val poolDtos =
            pool.map { entry ->
                val def = prizeRepository.findDefinitionById(entry.prizeDefinitionId)
                PityPrizePoolItemDto(
                    prizeDefinitionId = entry.prizeDefinitionId.value.toString(),
                    grade = def?.grade ?: "",
                    prizeName = def?.name ?: "",
                    weight = entry.weight,
                )
            }
        return PityRuleDto(
            id = rule.id.toString(),
            campaignId = rule.campaignId.value.toString(),
            threshold = rule.threshold,
            accumulationMode = rule.accumulationMode.name,
            sessionTimeoutSeconds = rule.sessionTimeoutSeconds,
            enabled = rule.enabled,
            prizePool = poolDtos,
        )
    }
}

/** Creates or updates the pity rule for a campaign. */
public class UpsertPityRuleUseCase(
    private val pityRepository: IPityRepository,
    private val campaignRepository: ICampaignRepository,
    private val prizeRepository: IPrizeRepository,
) {
    /** Validates and saves the pity rule + prize pool atomically. */
    public suspend fun execute(
        campaignId: UUID,
        request: UpsertPityRuleRequest,
    ): PityRuleDto {
        validateRequest(campaignId, request)
        return persistRuleAndPool(campaignId, request)
    }

    private suspend fun validateRequest(
        campaignId: UUID,
        request: UpsertPityRuleRequest,
    ) {
        campaignRepository.findUnlimitedById(CampaignId(campaignId))
            ?: throw IllegalArgumentException("Campaign $campaignId not found")
        require(request.threshold >= 2) { "Threshold must be >= 2" }
        require(request.prizePool.isNotEmpty()) { "Prize pool must have at least one entry" }
        val mode = AccumulationMode.valueOf(request.accumulationMode)
        if (mode == AccumulationMode.SESSION) {
            val sessionTimeout = request.sessionTimeoutSeconds
            requireNotNull(sessionTimeout) { "Session mode requires sessionTimeoutSeconds" }
            require(sessionTimeout > 0) { "sessionTimeoutSeconds must be > 0" }
        }
        val definitions = prizeRepository.findDefinitionsByCampaign(CampaignId(campaignId), CampaignType.UNLIMITED)
        val defIds = definitions.map { it.id.value }.toSet()
        request.prizePool.forEach { item ->
            val defId = UUID.fromString(item.prizeDefinitionId)
            require(defId in defIds) { "Prize definition $defId does not belong to campaign $campaignId" }
            require(item.weight > 0) { "Weight must be > 0" }
        }
    }

    private suspend fun persistRuleAndPool(
        campaignId: UUID,
        request: UpsertPityRuleRequest,
    ): PityRuleDto =
        newSuspendedTransaction {
            val now = Clock.System.now()
            val existing = pityRepository.findRuleByCampaignId(CampaignId(campaignId))
            val ruleId = existing?.id ?: UUID.randomUUID()
            val mode = AccumulationMode.valueOf(request.accumulationMode)
            val rule =
                PityRule(
                    id = ruleId,
                    campaignId = CampaignId(campaignId),
                    campaignType = "UNLIMITED",
                    threshold = request.threshold,
                    accumulationMode = mode,
                    sessionTimeoutSeconds = request.sessionTimeoutSeconds,
                    enabled = request.enabled,
                    createdAt = existing?.createdAt ?: now,
                    updatedAt = now,
                )
            val savedRule = pityRepository.saveRule(rule)
            val poolEntries =
                request.prizePool.map { item ->
                    PityPrizePoolEntry(
                        id = UUID.randomUUID(),
                        pityRuleId = ruleId,
                        prizeDefinitionId = PrizeDefinitionId(UUID.fromString(item.prizeDefinitionId)),
                        weight = item.weight,
                    )
                }
            pityRepository.replacePool(ruleId, poolEntries)
            buildResultDto(savedRule, ruleId)
        }

    private suspend fun buildResultDto(
        savedRule: PityRule,
        ruleId: UUID,
    ): PityRuleDto {
        val savedPool = pityRepository.findPoolByRuleId(ruleId)
        val poolDtos =
            savedPool.map { entry ->
                val def = prizeRepository.findDefinitionById(entry.prizeDefinitionId)
                PityPrizePoolItemDto(
                    prizeDefinitionId = entry.prizeDefinitionId.value.toString(),
                    grade = def?.grade ?: "",
                    prizeName = def?.name ?: "",
                    weight = entry.weight,
                )
            }
        return PityRuleDto(
            id = savedRule.id.toString(),
            campaignId = savedRule.campaignId.value.toString(),
            threshold = savedRule.threshold,
            accumulationMode = savedRule.accumulationMode.name,
            sessionTimeoutSeconds = savedRule.sessionTimeoutSeconds,
            enabled = savedRule.enabled,
            prizePool = poolDtos,
        )
    }
}

/** Deletes the pity rule for a campaign. */
public class DeletePityRuleUseCase(
    private val pityRepository: IPityRepository,
) {
    /** Deletes the rule (cascades to pool + trackers). */
    public suspend fun execute(campaignId: UUID) {
        val rule =
            pityRepository.findRuleByCampaignId(CampaignId(campaignId))
                ?: throw IllegalArgumentException("No pity rule found for campaign $campaignId")
        pityRepository.deleteRule(rule.id)
    }
}
