package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.contracts.endpoints.AdminEndpoints
import com.prizedraw.contracts.enums.CampaignStatus
import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.ShippingOrderStatus
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.contracts.enums.SupportTicketStatus
import com.prizedraw.contracts.enums.WithdrawalStatus
import com.prizedraw.domain.entities.DrawTicketStatus
import com.prizedraw.infrastructure.persistence.tables.DrawPointTransactionsTable
import com.prizedraw.infrastructure.persistence.tables.DrawTicketsTable
import com.prizedraw.infrastructure.persistence.tables.KujiCampaignsTable
import com.prizedraw.infrastructure.persistence.tables.PlayersTable
import com.prizedraw.infrastructure.persistence.tables.PrizeDefinitionsTable
import com.prizedraw.infrastructure.persistence.tables.ShippingOrdersTable
import com.prizedraw.infrastructure.persistence.tables.SupportTicketsTable
import com.prizedraw.infrastructure.persistence.tables.UnlimitedCampaignsTable
import com.prizedraw.infrastructure.persistence.tables.WithdrawalRequestsTable
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.JoinType
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.SqlExpressionBuilder.greaterEq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.or
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.sum
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * Admin dashboard aggregate endpoints.
 *
 * All routes require `authenticate("staff")` in the parent scope and
 * [StaffRole.OPERATOR] or above.
 *
 * - GET [AdminEndpoints.DASHBOARD_STATS]    -- key metrics for today
 * - GET [AdminEndpoints.DASHBOARD_ACTIVITY] -- last 10 draw events
 */
public fun Route.adminDashboardRoutes() {
    adminDashboardStatsRoute()
    adminDashboardActivityRoute()
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

@Serializable
private data class DashboardStatsResponse(
    val todayRevenue: Long,
    val activePlayers: Long,
    val activeCampaigns: Long,
    val pendingWithdrawals: Long,
    val openTickets: Long,
    val pendingShipments: Long,
    val revenueChange: Int,
    val playerChange: Int,
)

private fun Route.adminDashboardStatsRoute() {
    get(AdminEndpoints.DASHBOARD_STATS) {
        call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@get

        val stats =
            newSuspendedTransaction {
                val todayStart = todayStartOffsetDateTime()

                val todayRevenue = queryTodayRevenue(todayStart)
                val activePlayers = queryActivePlayers(todayStart)
                val activeCampaigns = queryActiveCampaigns()
                val pendingWithdrawals = queryPendingWithdrawals()
                val openTickets = queryOpenTickets()
                val pendingShipments = queryPendingShipments()

                DashboardStatsResponse(
                    todayRevenue = todayRevenue,
                    activePlayers = activePlayers,
                    activeCampaigns = activeCampaigns,
                    pendingWithdrawals = pendingWithdrawals,
                    openTickets = openTickets,
                    pendingShipments = pendingShipments,
                    revenueChange = 0,
                    playerChange = 0,
                )
            }

        call.respond(HttpStatusCode.OK, stats)
    }
}

/** SUM of draw-debit transaction amounts for today (both kuji and unlimited). */
private fun queryTodayRevenue(todayStart: OffsetDateTime): Long {
    val sumExpr = DrawPointTransactionsTable.amount.sum()
    return DrawPointTransactionsTable
        .select(sumExpr)
        .where {
            (
                (DrawPointTransactionsTable.type eq DrawPointTxType.KUJI_DRAW_DEBIT) or
                    (DrawPointTransactionsTable.type eq DrawPointTxType.UNLIMITED_DRAW_DEBIT)
            ) and
                (DrawPointTransactionsTable.createdAt greaterEq todayStart)
        }.firstOrNull()
        ?.get(sumExpr)
        ?.toLong()
        ?: 0L
}

/** COUNT DISTINCT players who drew at least once today. */
private fun queryActivePlayers(todayStart: OffsetDateTime): Long =
    DrawTicketsTable
        .selectAll()
        .where {
            DrawTicketsTable.drawnByPlayerId.isNotNull() and
                (DrawTicketsTable.drawnAt greaterEq todayStart)
        }.withDistinct()
        .mapNotNull { it[DrawTicketsTable.drawnByPlayerId] }
        .toSet()
        .size
        .toLong()

/** COUNT of campaigns in ACTIVE status across both campaign types. */
private fun queryActiveCampaigns(): Long {
    val kujiCount =
        KujiCampaignsTable
            .selectAll()
            .where {
                (KujiCampaignsTable.status eq CampaignStatus.ACTIVE) and
                    KujiCampaignsTable.deletedAt.isNull()
            }.count()
    val unlimitedCount =
        UnlimitedCampaignsTable
            .selectAll()
            .where {
                (UnlimitedCampaignsTable.status eq CampaignStatus.ACTIVE) and
                    UnlimitedCampaignsTable.deletedAt.isNull()
            }.count()
    return kujiCount + unlimitedCount
}

/** COUNT of withdrawal requests with status PENDING_REVIEW. */
private fun queryPendingWithdrawals(): Long =
    WithdrawalRequestsTable
        .selectAll()
        .where { WithdrawalRequestsTable.status eq WithdrawalStatus.PENDING_REVIEW }
        .count()

/** COUNT of support tickets with status OPEN. */
private fun queryOpenTickets(): Long =
    SupportTicketsTable
        .selectAll()
        .where { SupportTicketsTable.status eq SupportTicketStatus.OPEN }
        .count()

/** COUNT of shipping orders with status PENDING_SHIPMENT. */
private fun queryPendingShipments(): Long =
    ShippingOrdersTable
        .selectAll()
        .where { ShippingOrdersTable.status eq ShippingOrderStatus.PENDING_SHIPMENT }
        .count()

// ---------------------------------------------------------------------------
// Activity
// ---------------------------------------------------------------------------

@Serializable
private data class ActivityItem(
    val id: String,
    val type: String,
    val message: String,
    val timestamp: String,
)

private fun Route.adminDashboardActivityRoute() {
    get(AdminEndpoints.DASHBOARD_ACTIVITY) {
        call.requireStaffWithRole(StaffRole.OPERATOR) ?: return@get

        val items =
            newSuspendedTransaction {
                DrawTicketsTable
                    .join(
                        PlayersTable,
                        JoinType.INNER,
                        onColumn = DrawTicketsTable.drawnByPlayerId,
                        otherColumn = PlayersTable.id,
                    ).join(
                        PrizeDefinitionsTable,
                        JoinType.INNER,
                        onColumn = DrawTicketsTable.prizeDefinitionId,
                        otherColumn = PrizeDefinitionsTable.id,
                    ).selectAll()
                    .where { DrawTicketsTable.status eq DrawTicketStatus.DRAWN }
                    .orderBy(DrawTicketsTable.drawnAt, SortOrder.DESC)
                    .limit(10)
                    .map { row ->
                        val nickname = row[PlayersTable.nickname]
                        val grade = row[PrizeDefinitionsTable.grade]
                        val drawnAt = row[DrawTicketsTable.drawnAt]
                        val timestamp =
                            drawnAt?.let {
                                "%02d:%02d".format(it.hour, it.minute)
                            } ?: "--:--"
                        ActivityItem(
                            id = row[DrawTicketsTable.id].toString(),
                            type = "draw",
                            message = "$nickname 抽到 $grade",
                            timestamp = timestamp,
                        )
                    }
            }

        call.respond(HttpStatusCode.OK, items)
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the start of today (UTC midnight) as an [OffsetDateTime].
 *
 * Using UTC throughout keeps queries consistent with the `created_at` / `drawn_at`
 * columns which are stored as `TIMESTAMP WITH TIME ZONE` in UTC.
 */
private fun todayStartOffsetDateTime(): OffsetDateTime {
    val today = LocalDate.now(ZoneOffset.UTC)
    return today.atStartOfDay(ZoneOffset.UTC).toOffsetDateTime()
}
