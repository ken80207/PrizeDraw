package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.AuditLogFilters
import com.prizedraw.application.ports.input.admin.AuditLogPage
import com.prizedraw.application.ports.input.admin.IGetAuditLogUseCase
import com.prizedraw.application.ports.output.IAuditRepository

private const val MAX_PAGE_SIZE = 200

/**
 * Retrieves a filtered, paginated audit log for admin review.
 *
 * Delegates directly to [IAuditRepository.findFiltered] with the supplied [AuditLogFilters].
 */
public class GetAuditLogUseCase(
    private val auditRepository: IAuditRepository,
) : IGetAuditLogUseCase {
    override suspend fun execute(filters: AuditLogFilters): AuditLogPage {
        val limit = filters.limit.coerceIn(1, MAX_PAGE_SIZE)
        val offset = filters.offset.coerceAtLeast(0)
        val items =
            auditRepository.findFiltered(
                actorStaffId = filters.actorStaffId,
                actorPlayerId = filters.actorPlayerId,
                entityType = filters.entityType,
                action = filters.action,
                from = filters.from,
                until = filters.until,
                offset = offset,
                limit = limit,
            )
        return AuditLogPage(items = items, offset = offset, limit = limit)
    }
}
