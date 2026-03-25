package com.prizedraw.application.ports.input.admin

import com.prizedraw.domain.entities.Staff
import com.prizedraw.domain.valueobjects.StaffId

/**
 * Input port for deactivating a staff member account.
 *
 * Requires ADMIN role or above. A staff member cannot deactivate their own account.
 */
public interface IDeactivateStaffUseCase {
    /**
     * Deactivates the staff member identified by [targetStaffId].
     *
     * Sets [Staff.isActive] to false and soft-deletes the account by recording [Staff.deletedAt].
     *
     * @param actorStaffId The admin performing the deactivation.
     * @param targetStaffId The staff member to deactivate.
     * @return The updated [Staff] entity.
     */
    public suspend fun execute(
        actorStaffId: StaffId,
        targetStaffId: StaffId,
    ): Staff
}
