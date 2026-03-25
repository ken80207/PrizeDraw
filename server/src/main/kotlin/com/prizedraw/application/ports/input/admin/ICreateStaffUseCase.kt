package com.prizedraw.application.ports.input.admin

import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.entities.Staff
import com.prizedraw.domain.valueobjects.StaffId

/**
 * Input port for creating a new staff member account.
 *
 * Requires ADMIN role or above. The password is bcrypt-hashed before persistence.
 */
public interface ICreateStaffUseCase {
    /**
     * Creates and persists a new [Staff] account.
     *
     * @param actorStaffId The admin staff member creating the account.
     * @param email Unique login email for the new account.
     * @param name Display name for the new staff member.
     * @param role Permission role for the new staff member.
     * @param plainPassword Plain-text password to be hashed before storage.
     * @return The persisted [Staff] entity.
     */
    public suspend fun execute(
        actorStaffId: StaffId,
        email: String,
        name: String,
        role: StaffRole,
        plainPassword: String,
    ): Staff
}
