package com.prizedraw.application.ports.input.admin

import com.prizedraw.domain.entities.AuditLog
import kotlinx.datetime.Instant
import java.util.UUID

/** Filters for the admin audit log query. */
public data class AuditLogFilters(
    val actorStaffId: UUID? = null,
    val actorPlayerId: UUID? = null,
    val entityType: String? = null,
    val action: String? = null,
    val from: Instant? = null,
    val until: Instant? = null,
    val offset: Int = 0,
    val limit: Int = 50,
)

/** Paginated audit log result. */
public data class AuditLogPage(
    val items: List<AuditLog>,
    val offset: Int,
    val limit: Int,
)

/**
 * Input port for admin-level paginated audit log querying.
 *
 * Requires ADMIN role or above.
 */
public interface IGetAuditLogUseCase {
    /**
     * Returns a filtered, paginated page of audit log entries ordered by [AuditLog.createdAt] descending.
     *
     * @param filters Filtering and pagination parameters.
     * @return A [AuditLogPage] containing matching entries.
     */
    public suspend fun execute(filters: AuditLogFilters): AuditLogPage
}
