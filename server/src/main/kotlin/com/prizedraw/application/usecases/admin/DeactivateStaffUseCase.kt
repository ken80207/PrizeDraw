package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.IDeactivateStaffUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IStaffRepository
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.Staff
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/** Thrown when a staff member attempts to deactivate their own account. */
public class CannotDeactivateSelfException(
    staffId: StaffId,
) : IllegalStateException("Staff member ${staffId.value} cannot deactivate their own account")

/**
 * Deactivates a staff account by setting [Staff.isActive] to false and recording [Staff.deletedAt].
 *
 * The actor cannot deactivate their own account.
 */
public class DeactivateStaffUseCase(
    private val staffRepository: IStaffRepository,
    private val auditRepository: IAuditRepository,
) : IDeactivateStaffUseCase {
    override suspend fun execute(
        actorStaffId: StaffId,
        targetStaffId: StaffId,
    ): Staff {
        if (actorStaffId == targetStaffId) {
            throw CannotDeactivateSelfException(actorStaffId)
        }
        val target =
            staffRepository.findById(targetStaffId)
                ?: throw StaffNotFoundException(targetStaffId)
        val now = Clock.System.now()
        val updated =
            target.copy(
                isActive = false,
                deletedAt = now,
                updatedAt = now,
            )
        val saved = staffRepository.save(updated)
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = actorStaffId.value,
                action = "staff.deactivated",
                entityType = "Staff",
                entityId = targetStaffId.value,
                beforeValue = buildJsonObject { put("isActive", target.isActive) },
                afterValue = buildJsonObject { put("isActive", false) },
                metadata = buildJsonObject { put("actorStaffId", actorStaffId.value.toString()) },
                createdAt = now,
            ),
        )
        return saved
    }
}
