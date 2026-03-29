package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.services.TokenService
import com.prizedraw.domain.entities.RefreshTokenFamily
import com.prizedraw.domain.entities.TokenActorType
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.schema.tables.RefreshTokenFamiliesTable
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

/**
 * Exposed-backed implementation of [TokenService.RefreshTokenFamilyStore].
 *
 * Backed by the `refresh_token_families` table. The V013 migration adds `expires_at`,
 * `actor_type`, and `staff_id` columns which are fully persisted by this implementation.
 */
public class RefreshTokenFamilyRepositoryImpl : TokenService.RefreshTokenFamilyStore {
    override suspend fun findByFamilyToken(familyToken: String): RefreshTokenFamily? =
        newSuspendedTransaction {
            RefreshTokenFamiliesTable
                .selectAll()
                .where { RefreshTokenFamiliesTable.familyToken eq familyToken }
                .singleOrNull()
                ?.toRefreshTokenFamily()
        }

    override suspend fun save(family: RefreshTokenFamily): RefreshTokenFamily =
        newSuspendedTransaction {
            val existing =
                RefreshTokenFamiliesTable
                    .selectAll()
                    .where { RefreshTokenFamiliesTable.id eq family.id }
                    .singleOrNull()

            if (existing == null) {
                RefreshTokenFamiliesTable.insert {
                    it[id] = family.id
                    it[playerId] = family.playerId?.value ?: error("Player ID required")
                    // C-2 fix: store the opaque familyToken string, not the row UUID
                    it[familyToken] = family.familyToken
                    it[currentTokenHash] = family.currentTokenHash
                    it[revoked] = family.isRevoked
                    it[revokedAt] =
                        family.revokedAt?.let { i ->
                            OffsetDateTime.ofInstant(i.toJavaInstant(), ZoneOffset.UTC)
                        }
                    it[expiresAt] =
                        OffsetDateTime.ofInstant(
                            family.expiresAt.toJavaInstant(),
                            ZoneOffset.UTC,
                        )
                    it[actorType] = family.actorType.name
                    it[staffId] = family.staffId
                    it[createdAt] = OffsetDateTime.ofInstant(family.createdAt.toJavaInstant(), ZoneOffset.UTC)
                    it[updatedAt] = OffsetDateTime.ofInstant(family.updatedAt.toJavaInstant(), ZoneOffset.UTC)
                }
            } else {
                RefreshTokenFamiliesTable.update({ RefreshTokenFamiliesTable.id eq family.id }) {
                    it[currentTokenHash] = family.currentTokenHash
                    it[revoked] = family.isRevoked
                    it[revokedAt] =
                        family.revokedAt?.let { i ->
                            OffsetDateTime.ofInstant(i.toJavaInstant(), ZoneOffset.UTC)
                        }
                    it[expiresAt] =
                        OffsetDateTime.ofInstant(
                            family.expiresAt.toJavaInstant(),
                            ZoneOffset.UTC,
                        )
                    it[actorType] = family.actorType.name
                    it[staffId] = family.staffId
                    it[updatedAt] = OffsetDateTime.ofInstant(family.updatedAt.toJavaInstant(), ZoneOffset.UTC)
                }
            }

            RefreshTokenFamiliesTable
                .selectAll()
                .where { RefreshTokenFamiliesTable.id eq family.id }
                .single()
                .toRefreshTokenFamily()
        }

    override suspend fun revokeFamily(familyToken: String): Unit =
        newSuspendedTransaction {
            val now = OffsetDateTime.now(ZoneOffset.UTC)
            RefreshTokenFamiliesTable.update({
                RefreshTokenFamiliesTable.familyToken eq familyToken
            }) {
                it[revoked] = true
                it[revokedAt] = now
                it[updatedAt] = now
            }
        }

    private fun ResultRow.toRefreshTokenFamily(): RefreshTokenFamily =
        RefreshTokenFamily(
            id = this[RefreshTokenFamiliesTable.id],
            familyToken = this[RefreshTokenFamiliesTable.familyToken],
            actorType =
                runCatching {
                    TokenActorType.valueOf(this[RefreshTokenFamiliesTable.actorType])
                }.getOrDefault(TokenActorType.PLAYER),
            playerId = PlayerId(this[RefreshTokenFamiliesTable.playerId]),
            staffId = this[RefreshTokenFamiliesTable.staffId],
            currentTokenHash = this[RefreshTokenFamiliesTable.currentTokenHash],
            isRevoked = this[RefreshTokenFamiliesTable.revoked],
            revokedAt = this[RefreshTokenFamiliesTable.revokedAt]?.toInstant()?.toKotlinInstant(),
            expiresAt = this[RefreshTokenFamiliesTable.expiresAt].toInstant().toKotlinInstant(),
            createdAt = this[RefreshTokenFamiliesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[RefreshTokenFamiliesTable.updatedAt].toInstant().toKotlinInstant(),
        )
}
