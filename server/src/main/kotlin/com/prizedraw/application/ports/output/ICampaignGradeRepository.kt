package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.CampaignGrade
import com.prizedraw.domain.valueobjects.CampaignGradeId
import com.prizedraw.domain.valueobjects.CampaignId

/**
 * Output port for campaign-scoped grade persistence.
 */
public interface ICampaignGradeRepository {
    /** Returns all grades for a campaign, ordered by displayOrder. */
    public suspend fun findByCampaignId(campaignId: CampaignId): List<CampaignGrade>

    /** Returns a single campaign grade by ID, or null. */
    public suspend fun findById(id: CampaignGradeId): CampaignGrade?

    /** Inserts a list of campaign grades atomically. */
    public suspend fun saveAll(grades: List<CampaignGrade>): List<CampaignGrade>

    /** Replaces all grades for a campaign (delete existing + insert new). */
    public suspend fun replaceAll(
        campaignId: CampaignId,
        grades: List<CampaignGrade>,
    ): List<CampaignGrade>

    /** Deletes a single grade. Returns false if the grade has prize references. */
    public suspend fun delete(id: CampaignGradeId): Boolean

    /** Deletes all grades for a campaign that have no prize references. */
    public suspend fun deleteAllByCampaignId(campaignId: CampaignId)

    /** Counts how many prize_definitions reference this grade. */
    public suspend fun countPrizeReferences(id: CampaignGradeId): Long
}
