package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.ICampaignRepository
import com.prizedraw.contracts.enums.ApprovalStatus
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.entities.UnlimitedCampaign
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.infrastructure.persistence.inTransaction
import com.prizedraw.schema.tables.DrawTicketsTable
import com.prizedraw.schema.tables.KujiCampaignsTable
import com.prizedraw.schema.tables.TicketBoxesTable
import com.prizedraw.schema.tables.UnlimitedCampaignsTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.innerJoin
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.sum
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset

@Suppress("TooManyFunctions")
public class CampaignRepositoryImpl : ICampaignRepository {
    // --- Kuji Campaigns ---

    override suspend fun findKujiById(id: CampaignId): KujiCampaign? =
        inTransaction {
            KujiCampaignsTable
                .selectAll()
                .where { (KujiCampaignsTable.id eq id.value) and (KujiCampaignsTable.deletedAt.isNull()) }
                .singleOrNull()
                ?.toKujiCampaign()
        }

    override suspend fun findAllKuji(status: CampaignStatus?): List<KujiCampaign> =
        inTransaction {
            KujiCampaignsTable
                .selectAll()
                .where {
                    val base = KujiCampaignsTable.deletedAt.isNull()
                    if (status != null) {
                        base and (KujiCampaignsTable.status eq status)
                    } else {
                        base
                    }
                }.map { it.toKujiCampaign() }
        }

    override suspend fun findActiveKujiCampaigns(): List<KujiCampaign> =
        inTransaction {
            KujiCampaignsTable
                .selectAll()
                .where {
                    (KujiCampaignsTable.status eq CampaignStatus.ACTIVE) and
                        (KujiCampaignsTable.deletedAt.isNull())
                }.map { it.toKujiCampaign() }
        }

    override suspend fun saveKuji(campaign: KujiCampaign): KujiCampaign =
        inTransaction {
            val existing =
                KujiCampaignsTable
                    .selectAll()
                    .where { KujiCampaignsTable.id eq campaign.id.value }
                    .singleOrNull()

            if (existing == null) {
                KujiCampaignsTable.insert {
                    it[id] = campaign.id.value
                    it[title] = campaign.title
                    it[description] = campaign.description
                    it[coverImageUrl] = campaign.coverImageUrl
                    it[pricePerDraw] = campaign.pricePerDraw
                    it[drawSessionSeconds] = campaign.drawSessionSeconds
                    it[status] = campaign.status
                    it[activatedAt] = campaign.activatedAt?.toOffsetDateTime()
                    it[soldOutAt] = campaign.soldOutAt?.toOffsetDateTime()
                    it[createdByStaffId] = campaign.createdByStaffId
                    it[deletedAt] = campaign.deletedAt?.toOffsetDateTime()
                    it[createdAt] = campaign.createdAt.toOffsetDateTime()
                    it[updatedAt] = campaign.updatedAt.toOffsetDateTime()
                    it[approvalStatus] = campaign.approvalStatus.name
                    it[approvedBy] = campaign.approvedBy
                    it[approvedAt] = campaign.approvedAt?.toOffsetDateTime()
                }
            } else {
                KujiCampaignsTable.update({ KujiCampaignsTable.id eq campaign.id.value }) {
                    it[title] = campaign.title
                    it[description] = campaign.description
                    it[coverImageUrl] = campaign.coverImageUrl
                    it[pricePerDraw] = campaign.pricePerDraw
                    it[drawSessionSeconds] = campaign.drawSessionSeconds
                    it[status] = campaign.status
                    it[activatedAt] = campaign.activatedAt?.toOffsetDateTime()
                    it[soldOutAt] = campaign.soldOutAt?.toOffsetDateTime()
                    it[deletedAt] = campaign.deletedAt?.toOffsetDateTime()
                    it[updatedAt] = campaign.updatedAt.toOffsetDateTime()
                    it[approvalStatus] = campaign.approvalStatus.name
                    it[approvedBy] = campaign.approvedBy
                    it[approvedAt] = campaign.approvedAt?.toOffsetDateTime()
                }
            }

            KujiCampaignsTable
                .selectAll()
                .where { KujiCampaignsTable.id eq campaign.id.value }
                .single()
                .toKujiCampaign()
        }

    override suspend fun updateKujiStatus(
        id: CampaignId,
        status: CampaignStatus,
    ): Unit =
        inTransaction {
            KujiCampaignsTable.update({ KujiCampaignsTable.id eq id.value }) {
                it[KujiCampaignsTable.status] = status
                it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }

    // --- Unlimited Campaigns ---

    override suspend fun findUnlimitedById(id: CampaignId): UnlimitedCampaign? =
        inTransaction {
            UnlimitedCampaignsTable
                .selectAll()
                .where {
                    (UnlimitedCampaignsTable.id eq id.value) and
                        (UnlimitedCampaignsTable.deletedAt.isNull())
                }.singleOrNull()
                ?.toUnlimitedCampaign()
        }

    override suspend fun findAllUnlimited(status: CampaignStatus?): List<UnlimitedCampaign> =
        inTransaction {
            UnlimitedCampaignsTable
                .selectAll()
                .where {
                    val base = UnlimitedCampaignsTable.deletedAt.isNull()
                    if (status != null) {
                        base and (UnlimitedCampaignsTable.status eq status)
                    } else {
                        base
                    }
                }.map { it.toUnlimitedCampaign() }
        }

    override suspend fun findActiveUnlimitedCampaigns(): List<UnlimitedCampaign> =
        inTransaction {
            UnlimitedCampaignsTable
                .selectAll()
                .where {
                    (UnlimitedCampaignsTable.status eq CampaignStatus.ACTIVE) and
                        (UnlimitedCampaignsTable.deletedAt.isNull())
                }.map { it.toUnlimitedCampaign() }
        }

    override suspend fun saveUnlimited(campaign: UnlimitedCampaign): UnlimitedCampaign =
        inTransaction {
            val existing =
                UnlimitedCampaignsTable
                    .selectAll()
                    .where { UnlimitedCampaignsTable.id eq campaign.id.value }
                    .singleOrNull()

            if (existing == null) {
                UnlimitedCampaignsTable.insert {
                    it[id] = campaign.id.value
                    it[title] = campaign.title
                    it[description] = campaign.description
                    it[coverImageUrl] = campaign.coverImageUrl
                    it[pricePerDraw] = campaign.pricePerDraw
                    it[rateLimitPerSecond] = campaign.rateLimitPerSecond
                    it[status] = campaign.status
                    it[activatedAt] = campaign.activatedAt?.toOffsetDateTime()
                    it[createdByStaffId] = campaign.createdByStaffId
                    it[deletedAt] = campaign.deletedAt?.toOffsetDateTime()
                    it[createdAt] = campaign.createdAt.toOffsetDateTime()
                    it[updatedAt] = campaign.updatedAt.toOffsetDateTime()
                    it[approvalStatus] = campaign.approvalStatus.name
                    it[approvedBy] = campaign.approvedBy
                    it[approvedAt] = campaign.approvedAt?.toOffsetDateTime()
                }
            } else {
                UnlimitedCampaignsTable.update({ UnlimitedCampaignsTable.id eq campaign.id.value }) {
                    it[title] = campaign.title
                    it[description] = campaign.description
                    it[coverImageUrl] = campaign.coverImageUrl
                    it[pricePerDraw] = campaign.pricePerDraw
                    it[rateLimitPerSecond] = campaign.rateLimitPerSecond
                    it[status] = campaign.status
                    it[activatedAt] = campaign.activatedAt?.toOffsetDateTime()
                    it[deletedAt] = campaign.deletedAt?.toOffsetDateTime()
                    it[updatedAt] = campaign.updatedAt.toOffsetDateTime()
                    it[approvalStatus] = campaign.approvalStatus.name
                    it[approvedBy] = campaign.approvedBy
                    it[approvedAt] = campaign.approvedAt?.toOffsetDateTime()
                }
            }

            UnlimitedCampaignsTable
                .selectAll()
                .where { UnlimitedCampaignsTable.id eq campaign.id.value }
                .single()
                .toUnlimitedCampaign()
        }

    override suspend fun updateUnlimitedStatus(
        id: CampaignId,
        status: CampaignStatus,
    ): Unit =
        inTransaction {
            UnlimitedCampaignsTable.update({ UnlimitedCampaignsTable.id eq id.value }) {
                it[UnlimitedCampaignsTable.status] = status
                it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }

    // --- Batch lookups ---

    override suspend fun findKujiByIds(ids: List<CampaignId>): List<KujiCampaign> {
        if (ids.isEmpty()) {
            return emptyList()
        }
        return inTransaction {
            KujiCampaignsTable
                .selectAll()
                .where {
                    (KujiCampaignsTable.id inList ids.map { it.value }) and
                        KujiCampaignsTable.deletedAt.isNull()
                }.map { it.toKujiCampaign() }
        }
    }

    override suspend fun findUnlimitedByIds(ids: List<CampaignId>): List<UnlimitedCampaign> {
        if (ids.isEmpty()) {
            return emptyList()
        }
        return inTransaction {
            UnlimitedCampaignsTable
                .selectAll()
                .where {
                    (UnlimitedCampaignsTable.id inList ids.map { it.value }) and
                        UnlimitedCampaignsTable.deletedAt.isNull()
                }.map { it.toUnlimitedCampaign() }
        }
    }

    override suspend fun findActiveKujiCampaignsNotLowStockNotified(): List<KujiCampaign> =
        inTransaction {
            KujiCampaignsTable
                .selectAll()
                .where {
                    (KujiCampaignsTable.status eq CampaignStatus.ACTIVE) and
                        KujiCampaignsTable.deletedAt.isNull() and
                        KujiCampaignsTable.lowStockNotifiedAt.isNull()
                }.map { it.toKujiCampaign() }
        }

    override suspend fun countTotalTickets(campaignId: CampaignId): Int =
        inTransaction {
            TicketBoxesTable
                .select(TicketBoxesTable.totalTickets.sum())
                .where { TicketBoxesTable.kujiCampaignId eq campaignId.value }
                .singleOrNull()
                ?.get(TicketBoxesTable.totalTickets.sum())
                ?: 0
        }

    override suspend fun countRemainingTickets(campaignId: CampaignId): Int =
        inTransaction {
            DrawTicketsTable
                .innerJoin(
                    TicketBoxesTable,
                    { DrawTicketsTable.ticketBoxId },
                    { TicketBoxesTable.id },
                ).selectAll()
                .where {
                    (TicketBoxesTable.kujiCampaignId eq campaignId.value) and
                        DrawTicketsTable.drawnByPlayerId.isNull()
                }.count()
                .toInt()
        }

    override suspend fun markLowStockNotified(campaignId: CampaignId): Unit =
        inTransaction {
            KujiCampaignsTable.update({ KujiCampaignsTable.id eq campaignId.value }) {
                it[lowStockNotifiedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }

    private fun ResultRow.toKujiCampaign(): KujiCampaign =
        KujiCampaign(
            id = CampaignId(this[KujiCampaignsTable.id]),
            title = this[KujiCampaignsTable.title],
            description = this[KujiCampaignsTable.description],
            coverImageUrl = this[KujiCampaignsTable.coverImageUrl],
            pricePerDraw = this[KujiCampaignsTable.pricePerDraw],
            drawSessionSeconds = this[KujiCampaignsTable.drawSessionSeconds],
            status = this[KujiCampaignsTable.status],
            activatedAt = this[KujiCampaignsTable.activatedAt]?.toInstant()?.toKotlinInstant(),
            soldOutAt = this[KujiCampaignsTable.soldOutAt]?.toInstant()?.toKotlinInstant(),
            createdByStaffId = this[KujiCampaignsTable.createdByStaffId],
            deletedAt = this[KujiCampaignsTable.deletedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[KujiCampaignsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[KujiCampaignsTable.updatedAt].toInstant().toKotlinInstant(),
            approvalStatus = ApprovalStatus.valueOf(this[KujiCampaignsTable.approvalStatus]),
            approvedBy = this[KujiCampaignsTable.approvedBy],
            approvedAt = this[KujiCampaignsTable.approvedAt]?.toInstant()?.toKotlinInstant(),
            lowStockNotifiedAt = this[KujiCampaignsTable.lowStockNotifiedAt]?.toInstant()?.toKotlinInstant(),
        )

    private fun ResultRow.toUnlimitedCampaign(): UnlimitedCampaign =
        UnlimitedCampaign(
            id = CampaignId(this[UnlimitedCampaignsTable.id]),
            title = this[UnlimitedCampaignsTable.title],
            description = this[UnlimitedCampaignsTable.description],
            coverImageUrl = this[UnlimitedCampaignsTable.coverImageUrl],
            pricePerDraw = this[UnlimitedCampaignsTable.pricePerDraw],
            rateLimitPerSecond = this[UnlimitedCampaignsTable.rateLimitPerSecond],
            status = this[UnlimitedCampaignsTable.status],
            activatedAt = this[UnlimitedCampaignsTable.activatedAt]?.toInstant()?.toKotlinInstant(),
            createdByStaffId = this[UnlimitedCampaignsTable.createdByStaffId],
            deletedAt = this[UnlimitedCampaignsTable.deletedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[UnlimitedCampaignsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[UnlimitedCampaignsTable.updatedAt].toInstant().toKotlinInstant(),
            approvalStatus = ApprovalStatus.valueOf(this[UnlimitedCampaignsTable.approvalStatus]),
            approvedBy = this[UnlimitedCampaignsTable.approvedBy],
            approvedAt = this[UnlimitedCampaignsTable.approvedAt]?.toInstant()?.toKotlinInstant(),
        )
}

private fun kotlinx.datetime.Instant.toOffsetDateTime(): OffsetDateTime =
    OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)
