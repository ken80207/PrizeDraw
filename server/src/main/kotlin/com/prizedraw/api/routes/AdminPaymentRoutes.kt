package com.prizedraw.api.routes

import com.prizedraw.api.plugins.requireStaffWithRole
import com.prizedraw.contracts.enums.PaymentOrderStatus
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.schema.tables.PaymentOrdersTable
import io.ktor.http.HttpStatusCode
import io.ktor.server.application.call
import io.ktor.server.response.respond
import io.ktor.server.routing.Route
import io.ktor.server.routing.get
import kotlinx.serialization.Serializable
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction

private const val ADMIN_PAYMENTS_PATH = "/api/v1/admin/payments"
private const val DEFAULT_PAYMENT_LIMIT = 50
private const val MAX_PAYMENT_LIMIT = 200

@Serializable
private data class PaymentOrderResponse(
    val id: String,
    val playerId: String,
    val fiatAmount: Int,
    val currencyCode: String,
    val drawPointsGranted: Int,
    val gateway: String,
    val gatewayTransactionId: String?,
    val paymentMethod: String?,
    val status: String,
    val paidAt: String?,
    val failedAt: String?,
    val refundedAt: String?,
    val expiresAt: String?,
    val createdAt: String,
    val updatedAt: String,
)

@Serializable
private data class PaymentOrderPageResponse(
    val items: List<PaymentOrderResponse>,
    val offset: Int,
    val limit: Int,
)

/**
 * Admin payment order routes.
 *
 * All routes require `authenticate("staff")` in the parent scope and [StaffRole.ADMIN].
 *
 * - GET /api/v1/admin/payments — paginated list of payment_orders with optional `status` filter
 *
 * Query parameters:
 * - `status`  — one of [PaymentOrderStatus] values (optional)
 * - `offset`  — pagination offset, defaults to 0
 * - `limit`   — page size 1–200, defaults to 50
 */
public fun Route.adminPaymentRoutes() {
    get(ADMIN_PAYMENTS_PATH) {
        call.requireStaffWithRole(StaffRole.ADMIN) ?: return@get

        val statusParam = call.request.queryParameters["status"]
        val offset = call.request.queryParameters["offset"]?.toIntOrNull() ?: 0
        val limit = (call.request.queryParameters["limit"]?.toIntOrNull() ?: DEFAULT_PAYMENT_LIMIT).coerceIn(1, MAX_PAYMENT_LIMIT)

        val statusFilter =
            statusParam?.let {
                runCatching { PaymentOrderStatus.valueOf(it) }.getOrElse {
                    return@get call.respond(
                        HttpStatusCode.BadRequest,
                        mapOf("error" to "Invalid status value: $it"),
                    )
                }
            }

        val page =
            newSuspendedTransaction {
                val query =
                    PaymentOrdersTable
                        .selectAll()
                        .apply {
                            if (statusFilter != null) {
                                where { PaymentOrdersTable.status eq statusFilter }
                            }
                        }.orderBy(PaymentOrdersTable.createdAt, SortOrder.DESC)
                        .limit(limit, offset.toLong())

                query.map { row ->
                    PaymentOrderResponse(
                        id = row[PaymentOrdersTable.id].toString(),
                        playerId = row[PaymentOrdersTable.playerId].toString(),
                        fiatAmount = row[PaymentOrdersTable.fiatAmount],
                        currencyCode = row[PaymentOrdersTable.currencyCode],
                        drawPointsGranted = row[PaymentOrdersTable.drawPointsGranted],
                        gateway = row[PaymentOrdersTable.gateway].name,
                        gatewayTransactionId = row[PaymentOrdersTable.gatewayTransactionId],
                        paymentMethod = row[PaymentOrdersTable.paymentMethod],
                        status = row[PaymentOrdersTable.status].name,
                        paidAt = row[PaymentOrdersTable.paidAt]?.toString(),
                        failedAt = row[PaymentOrdersTable.failedAt]?.toString(),
                        refundedAt = row[PaymentOrdersTable.refundedAt]?.toString(),
                        expiresAt = row[PaymentOrdersTable.expiresAt]?.toString(),
                        createdAt = row[PaymentOrdersTable.createdAt].toString(),
                        updatedAt = row[PaymentOrdersTable.updatedAt].toString(),
                    )
                }
            }

        call.respond(HttpStatusCode.OK, PaymentOrderPageResponse(items = page, offset = offset, limit = limit))
    }
}
