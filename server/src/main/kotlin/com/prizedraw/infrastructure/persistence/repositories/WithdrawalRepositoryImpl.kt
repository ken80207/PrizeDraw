package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IWithdrawalRepository
import com.prizedraw.contracts.enums.WithdrawalStatus
import com.prizedraw.domain.entities.WithdrawalRequest
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.infrastructure.persistence.tables.WithdrawalRequestsTable
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/**
 * Exposed-backed implementation of [IWithdrawalRepository].
 */
public class WithdrawalRepositoryImpl : IWithdrawalRepository {
    override suspend fun findById(id: UUID): WithdrawalRequest? =
        newSuspendedTransaction {
            WithdrawalRequestsTable
                .selectAll()
                .where { WithdrawalRequestsTable.id eq id }
                .singleOrNull()
                ?.toWithdrawalRequest()
        }

    override suspend fun findByPlayer(
        playerId: PlayerId,
        offset: Int,
        limit: Int,
    ): List<WithdrawalRequest> =
        newSuspendedTransaction {
            WithdrawalRequestsTable
                .selectAll()
                .where { WithdrawalRequestsTable.playerId eq playerId.value }
                .orderBy(WithdrawalRequestsTable.createdAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toWithdrawalRequest() }
        }

    override suspend fun findByStatus(
        status: WithdrawalStatus,
        offset: Int,
        limit: Int,
    ): List<WithdrawalRequest> =
        newSuspendedTransaction {
            WithdrawalRequestsTable
                .selectAll()
                .where { WithdrawalRequestsTable.status eq status }
                .orderBy(WithdrawalRequestsTable.createdAt, org.jetbrains.exposed.sql.SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toWithdrawalRequest() }
        }

    override suspend fun save(request: WithdrawalRequest): WithdrawalRequest =
        newSuspendedTransaction {
            val existing =
                WithdrawalRequestsTable
                    .selectAll()
                    .where { WithdrawalRequestsTable.id eq request.id }
                    .singleOrNull()
            if (existing == null) {
                WithdrawalRequestsTable.insert {
                    it[id] = request.id
                    it[playerId] = request.playerId.value
                    it[pointsAmount] = request.pointsAmount
                    it[fiatAmount] = request.fiatAmount
                    it[currencyCode] = request.currencyCode
                    it[bankName] = request.bankName
                    it[bankCode] = request.bankCode
                    it[accountHolderName] = request.accountHolderName
                    it[accountNumber] = request.accountNumber
                    it[status] = request.status
                    it[reviewedByStaffId] = request.reviewedByStaffId
                    it[reviewedAt] = request.reviewedAt?.toOffsetDateTime()
                    it[transferredAt] = request.transferredAt?.toOffsetDateTime()
                    it[rejectionReason] = request.rejectionReason
                    it[createdAt] = request.createdAt.toOffsetDateTime()
                    it[updatedAt] = request.updatedAt.toOffsetDateTime()
                }
            } else {
                WithdrawalRequestsTable.update({ WithdrawalRequestsTable.id eq request.id }) {
                    it[status] = request.status
                    it[reviewedByStaffId] = request.reviewedByStaffId
                    it[reviewedAt] = request.reviewedAt?.toOffsetDateTime()
                    it[transferredAt] = request.transferredAt?.toOffsetDateTime()
                    it[rejectionReason] = request.rejectionReason
                    it[updatedAt] = request.updatedAt.toOffsetDateTime()
                }
            }
            WithdrawalRequestsTable
                .selectAll()
                .where { WithdrawalRequestsTable.id eq request.id }
                .single()
                .toWithdrawalRequest()
        }

    private fun ResultRow.toWithdrawalRequest(): WithdrawalRequest =
        WithdrawalRequest(
            id = this[WithdrawalRequestsTable.id],
            playerId = PlayerId(this[WithdrawalRequestsTable.playerId]),
            pointsAmount = this[WithdrawalRequestsTable.pointsAmount],
            fiatAmount = this[WithdrawalRequestsTable.fiatAmount],
            currencyCode = this[WithdrawalRequestsTable.currencyCode],
            bankName = this[WithdrawalRequestsTable.bankName],
            bankCode = this[WithdrawalRequestsTable.bankCode],
            accountHolderName = this[WithdrawalRequestsTable.accountHolderName],
            accountNumber = this[WithdrawalRequestsTable.accountNumber],
            status = this[WithdrawalRequestsTable.status],
            reviewedByStaffId = this[WithdrawalRequestsTable.reviewedByStaffId],
            reviewedAt = this[WithdrawalRequestsTable.reviewedAt]?.toInstant()?.toKotlinInstant(),
            transferredAt = this[WithdrawalRequestsTable.transferredAt]?.toInstant()?.toKotlinInstant(),
            rejectionReason = this[WithdrawalRequestsTable.rejectionReason],
            createdAt = this[WithdrawalRequestsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[WithdrawalRequestsTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

private fun kotlinx.datetime.Instant.toOffsetDateTime(): OffsetDateTime =
    OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)
