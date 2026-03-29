package com.prizedraw.notification.infrastructure.persistence

import com.prizedraw.contracts.enums.ApprovalStatus
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.domain.entities.KujiCampaign
import com.prizedraw.domain.valueobjects.CampaignId
import com.prizedraw.notification.ports.ICampaignRepository
import com.prizedraw.schema.tables.DrawTicketsTable
import com.prizedraw.schema.tables.KujiCampaignsTable
import com.prizedraw.schema.tables.TicketBoxesTable
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.innerJoin
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.sum
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * Exposed-backed implementation of [ICampaignRepository].
 *
 * Implements only the low-stock notification subset of the full campaign repository
 * interface; no campaign CRUD methods are included.
 */
public class CampaignRepositoryImpl : ICampaignRepository {
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
}
