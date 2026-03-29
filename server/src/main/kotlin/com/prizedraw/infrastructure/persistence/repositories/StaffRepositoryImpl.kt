package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IStaffRepository
import com.prizedraw.domain.entities.Staff
import com.prizedraw.domain.valueobjects.EmailAddress
import com.prizedraw.domain.valueobjects.StaffId
import com.prizedraw.schema.tables.StaffTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** Exposed-backed implementation of [IStaffRepository]. */
public class StaffRepositoryImpl : IStaffRepository {
    override suspend fun findById(id: StaffId): Staff? =
        newSuspendedTransaction {
            StaffTable
                .selectAll()
                .where {
                    (StaffTable.id eq id.value) and
                        (StaffTable.deletedAt.isNull()) and
                        (StaffTable.isActive eq true)
                }.singleOrNull()
                ?.toStaff()
        }

    override suspend fun findByEmail(email: String): Staff? =
        newSuspendedTransaction {
            StaffTable
                .selectAll()
                .where {
                    (StaffTable.email eq email) and
                        (StaffTable.deletedAt.isNull()) and
                        (StaffTable.isActive eq true)
                }.singleOrNull()
                ?.toStaff()
        }

    override suspend fun save(staff: Staff): Staff =
        newSuspendedTransaction {
            val existing =
                StaffTable
                    .selectAll()
                    .where { StaffTable.id eq staff.id }
                    .singleOrNull()
            if (existing == null) {
                StaffTable.insert {
                    it[id] = staff.id
                    it[name] = staff.name
                    it[email] = staff.email.value
                    it[hashedPassword] = staff.hashedPassword
                    it[role] = staff.role
                    it[isActive] = staff.isActive
                    it[lastLoginAt] = staff.lastLoginAt?.toOffsetDateTime()
                    it[createdByStaffId] = staff.createdByStaffId
                    it[deletedAt] = staff.deletedAt?.toOffsetDateTime()
                    it[createdAt] = staff.createdAt.toOffsetDateTime()
                    it[updatedAt] = staff.updatedAt.toOffsetDateTime()
                }
            } else {
                StaffTable.update({ StaffTable.id eq staff.id }) {
                    it[name] = staff.name
                    it[role] = staff.role
                    it[isActive] = staff.isActive
                    it[deletedAt] = staff.deletedAt?.toOffsetDateTime()
                    it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
                }
            }
            StaffTable
                .selectAll()
                .where { StaffTable.id eq staff.id }
                .single()
                .toStaff()
        }

    override suspend fun findAll(): List<Staff> =
        newSuspendedTransaction {
            StaffTable
                .selectAll()
                .where {
                    (StaffTable.deletedAt.isNull()) and (StaffTable.isActive eq true)
                }.map { it.toStaff() }
        }

    override suspend fun updateLastLogin(id: UUID): Unit =
        newSuspendedTransaction {
            StaffTable.update({ StaffTable.id eq id }) {
                it[lastLoginAt] = OffsetDateTime.now(ZoneOffset.UTC)
                it[updatedAt] = OffsetDateTime.now(ZoneOffset.UTC)
            }
        }

    private fun ResultRow.toStaff(): Staff =
        Staff(
            id = this[StaffTable.id],
            name = this[StaffTable.name],
            email = EmailAddress(this[StaffTable.email]),
            hashedPassword = this[StaffTable.hashedPassword],
            role = this[StaffTable.role],
            isActive = this[StaffTable.isActive],
            lastLoginAt = this[StaffTable.lastLoginAt]?.toInstant()?.toKotlinInstant(),
            createdByStaffId = this[StaffTable.createdByStaffId],
            deletedAt = this[StaffTable.deletedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[StaffTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[StaffTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

private fun kotlinx.datetime.Instant.toOffsetDateTime(): OffsetDateTime =
    OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)
