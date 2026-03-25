package com.prizedraw.application.usecases.admin

import com.prizedraw.application.ports.input.admin.IUpdateStaffRoleUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IStaffRepository
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.Staff
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/** Thrown when the target staff member is not found or inactive. */
public class StaffNotFoundException(
    staffId: StaffId,
) : IllegalArgumentException("Staff ${staffId.value} not found")

/**
 * Changes the role of an existing staff member.
 *
 * An ADMIN can assign roles up to ADMIN. Only an OWNER can assign the OWNER role.
 */
public class UpdateStaffRoleUseCase(
    private val staffRepository: IStaffRepository,
    private val auditRepository: IAuditRepository,
) : IUpdateStaffRoleUseCase {
    override suspend fun execute(
        actorStaffId: StaffId,
        targetStaffId: StaffId,
        newRole: StaffRole,
    ): Staff {
        val actor =
            staffRepository.findById(actorStaffId)
                ?: throw StaffNotFoundException(actorStaffId)
        val target =
            staffRepository.findById(targetStaffId)
                ?: throw StaffNotFoundException(targetStaffId)
        if (newRole == StaffRole.OWNER && actor.role != StaffRole.OWNER) {
            throw InsufficientRoleForAssignmentException(newRole, actor.role)
        }
        val now = Clock.System.now()
        val updated = target.copy(role = newRole, updatedAt = now)
        val saved = staffRepository.save(updated)
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = actorStaffId.value,
                action = "staff.role.updated",
                entityType = "Staff",
                entityId = targetStaffId.value,
                beforeValue = buildJsonObject { put("role", target.role.name) },
                afterValue = buildJsonObject { put("role", newRole.name) },
                metadata = buildJsonObject { put("actorStaffId", actorStaffId.value.toString()) },
                createdAt = now,
            ),
        )
        return saved
    }
}
