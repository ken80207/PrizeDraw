package com.prizedraw.application.ports.input.admin

import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.entities.Staff
import com.prizedraw.domain.valueobjects.StaffId

/**
 * Input port for changing the role of an existing staff member.
 *
 * Requires ADMIN role. An ADMIN cannot assign the OWNER role — only an OWNER can.
 */
public interface IUpdateStaffRoleUseCase {
    /**
     * Updates the [StaffRole] of [targetStaffId].
     *
     * @param actorStaffId The staff member performing the role change.
     * @param targetStaffId The staff member whose role is being changed.
     * @param newRole The new role to assign.
     * @return The updated [Staff] entity.
     */
    public suspend fun execute(
        actorStaffId: StaffId,
        targetStaffId: StaffId,
        newRole: StaffRole,
    ): Staff
}
