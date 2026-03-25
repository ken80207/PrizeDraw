package com.prizedraw.domain.entities

import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.valueobjects.EmailAddress
import kotlinx.datetime.Instant
import java.util.UUID

/**
 * A platform employee with back-office access (後台人員).
 *
 * Staff are distinct from [Player] accounts and authenticate via email and password
 * (bcrypt-hashed, minimum cost 12). The [role] determines the permission scope for
 * back-office operations.
 *
 * Soft-deleted staff accounts ([deletedAt] non-null) retain all historical associations
 * for audit trail integrity; their [isActive] must be false.
 *
 * @property id Surrogate primary key.
 * @property name Display name.
 * @property email Login email. Unique per active account.
 * @property hashedPassword Bcrypt hash of the password (min cost 12).
 * @property role Permission scope for back-office operations.
 * @property isActive False revokes access without deletion.
 * @property lastLoginAt Timestamp of the most recent login. Null for new accounts.
 * @property createdByStaffId FK to the Admin who created this account. Null for seed accounts.
 * @property deletedAt Soft-delete timestamp. Null for active accounts.
 * @property createdAt Creation timestamp.
 * @property updatedAt Last mutation timestamp.
 */
public data class Staff(
    val id: UUID,
    val name: String,
    val email: EmailAddress,
    val hashedPassword: String,
    val role: StaffRole,
    val isActive: Boolean,
    val lastLoginAt: Instant?,
    val createdByStaffId: UUID?,
    val deletedAt: Instant?,
    val createdAt: Instant,
    val updatedAt: Instant,
)
