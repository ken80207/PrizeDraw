package com.prizedraw.application.usecases.admin

import at.favre.lib.crypto.bcrypt.BCrypt
import com.prizedraw.application.ports.input.admin.ICreateStaffUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IStaffRepository
import com.prizedraw.contracts.enums.StaffRole
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.Staff
import com.prizedraw.domain.valueobjects.EmailAddress
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/** Thrown when attempting to create a staff account with a duplicate email. */
public class StaffEmailAlreadyExistsException(
    email: String,
) : IllegalArgumentException("Staff account with email '$email' already exists")

/** Thrown when an admin attempts to assign the OWNER role (only OWNER can grant OWNER). */
public class InsufficientRoleForAssignmentException(
    targetRole: StaffRole,
    actorRole: StaffRole,
) : IllegalStateException("Actor role $actorRole cannot assign $targetRole")

private const val BCRYPT_COST = 12
private const val MIN_PASSWORD_LENGTH = 8

/**
 * Creates a new staff member account with a bcrypt-hashed password.
 *
 * Validates:
 * - Email is unique.
 * - Actor is ADMIN or above.
 * - OWNER role assignment requires the actor to be an OWNER.
 */
public class CreateStaffUseCase(
    private val staffRepository: IStaffRepository,
    private val auditRepository: IAuditRepository,
) : ICreateStaffUseCase {
    override suspend fun execute(
        actorStaffId: StaffId,
        email: String,
        name: String,
        role: StaffRole,
        plainPassword: String,
    ): Staff {
        val actor = staffRepository.findById(actorStaffId)
        check(actor != null) { "Actor staff ${actorStaffId.value} not found" }
        if (role == StaffRole.OWNER && actor.role != StaffRole.OWNER) {
            throw InsufficientRoleForAssignmentException(role, actor.role)
        }
        val existing = staffRepository.findByEmail(email)
        if (existing != null) {
            throw StaffEmailAlreadyExistsException(email)
        }
        require(plainPassword.length >= MIN_PASSWORD_LENGTH) {
            "Password must be at least $MIN_PASSWORD_LENGTH characters"
        }
        val hashedPassword =
            BCrypt.withDefaults().hashToString(BCRYPT_COST, plainPassword.toCharArray())
        val now = Clock.System.now()
        val staff =
            Staff(
                id = UUID.randomUUID(),
                name = name,
                email = EmailAddress(email),
                hashedPassword = hashedPassword,
                role = role,
                isActive = true,
                lastLoginAt = null,
                createdByStaffId = actorStaffId.value,
                deletedAt = null,
                createdAt = now,
                updatedAt = now,
            )
        val saved = staffRepository.save(staff)
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = actorStaffId.value,
                action = "staff.created",
                entityType = "Staff",
                entityId = saved.id,
                beforeValue = null,
                afterValue =
                    buildJsonObject {
                        put("email", email)
                        put("role", role.name)
                    },
                metadata = buildJsonObject { put("actorStaffId", actorStaffId.value.toString()) },
                createdAt = now,
            ),
        )
        return saved
    }
}
