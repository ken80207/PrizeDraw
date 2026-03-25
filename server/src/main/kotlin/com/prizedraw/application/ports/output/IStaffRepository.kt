package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.Staff
import com.prizedraw.domain.valueobjects.StaffId
import java.util.UUID

/**
 * Output port for persisting and querying [Staff] entities.
 */
public interface IStaffRepository {
    /**
     * Finds an active [Staff] member by their primary key.
     *
     * Soft-deleted or inactive staff members return null.
     *
     * @param id The staff member's identifier.
     * @return The matching [Staff], or null if not found or inactive.
     */
    public suspend fun findById(id: StaffId): Staff?

    /**
     * Finds a [Staff] member by their login email.
     *
     * Only returns active (non-deleted, [Staff.isActive] = true) accounts.
     *
     * @param email The login email address.
     * @return The matching [Staff], or null if not found.
     */
    public suspend fun findByEmail(email: String): Staff?

    /**
     * Persists a [Staff] entity (insert or update).
     *
     * @param staff The staff entity to persist.
     * @return The persisted entity.
     */
    public suspend fun save(staff: Staff): Staff

    /**
     * Returns all active staff members.
     *
     * @return List of active staff members ordered by [Staff.createdAt] descending.
     */
    public suspend fun findAll(): List<Staff>

    /**
     * Updates the [Staff.lastLoginAt] timestamp for the given staff member.
     *
     * @param id The staff member's identifier.
     */
    public suspend fun updateLastLogin(id: UUID)
}
