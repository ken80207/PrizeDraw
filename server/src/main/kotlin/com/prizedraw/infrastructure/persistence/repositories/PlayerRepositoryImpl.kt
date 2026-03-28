package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.contracts.enums.DrawAnimationMode
import com.prizedraw.contracts.enums.OAuthProvider
import com.prizedraw.domain.entities.Player
import com.prizedraw.domain.valueobjects.PhoneNumber
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.infrastructure.persistence.tables.PlayersTable
import kotlinx.datetime.Instant
import kotlinx.datetime.toJavaInstant
import kotlinx.datetime.toKotlinInstant
import org.jetbrains.exposed.sql.ResultRow
import org.jetbrains.exposed.sql.SortOrder
import org.jetbrains.exposed.sql.SqlExpressionBuilder.eq
import org.jetbrains.exposed.sql.and
import org.jetbrains.exposed.sql.insert
import org.jetbrains.exposed.sql.selectAll
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.jetbrains.exposed.sql.update
import java.time.OffsetDateTime
import java.time.ZoneOffset

/**
 * Exposed-backed implementation of [IPlayerRepository].
 *
 * All mutations use [newSuspendedTransaction] for coroutine-safe execution on Dispatchers.IO.
 * [updateBalance] implements optimistic locking: the UPDATE is conditional on the version
 * column matching [expectedVersion], and returns false if zero rows were affected.
 */
public class PlayerRepositoryImpl : IPlayerRepository {
    override suspend fun findById(id: PlayerId): Player? =
        newSuspendedTransaction {
            PlayersTable
                .selectAll()
                .where { (PlayersTable.id eq id.value) and (PlayersTable.deletedAt.isNull()) }
                .singleOrNull()
                ?.toPlayer()
        }

    override suspend fun findByOAuth(
        provider: OAuthProvider,
        subject: String,
    ): Player? =
        newSuspendedTransaction {
            PlayersTable
                .selectAll()
                .where {
                    (PlayersTable.oauthProvider eq provider.name) and
                        (PlayersTable.oauthSubject eq subject) and
                        (PlayersTable.deletedAt.isNull())
                }.singleOrNull()
                ?.toPlayer()
        }

    override suspend fun findByPhone(phone: PhoneNumber): Player? =
        newSuspendedTransaction {
            PlayersTable
                .selectAll()
                .where {
                    (PlayersTable.phoneNumber eq phone.value) and
                        (PlayersTable.deletedAt.isNull())
                }.singleOrNull()
                ?.toPlayer()
        }

    override suspend fun save(player: Player): Player =
        newSuspendedTransaction {
            val existingRow =
                PlayersTable
                    .selectAll()
                    .where { PlayersTable.id eq player.id.value }
                    .singleOrNull()

            if (existingRow == null) {
                PlayersTable.insert {
                    it[id] = player.id.value
                    it[nickname] = player.nickname
                    it[playerCode] = player.playerCode
                    it[avatarUrl] = player.avatarUrl
                    it[phoneNumber] = player.phoneNumber?.value
                    it[phoneVerifiedAt] = player.phoneVerifiedAt?.toOffsetDateTime()
                    it[oauthProvider] = player.oauthProvider.name
                    it[oauthSubject] = player.oauthSubject
                    it[drawPointsBalance] = player.drawPointsBalance
                    it[revenuePointsBalance] = player.revenuePointsBalance
                    it[version] = player.version
                    it[xp] = player.xp
                    it[level] = player.level
                    it[tier] = player.tier
                    it[preferredAnimationMode] = player.preferredAnimationMode.name
                    it[locale] = player.locale
                    it[isActive] = player.isActive
                    it[deletedAt] = player.deletedAt?.toOffsetDateTime()
                    it[createdAt] = player.createdAt.toOffsetDateTime()
                    it[updatedAt] = player.updatedAt.toOffsetDateTime()
                }
            } else {
                PlayersTable.update({ PlayersTable.id eq player.id.value }) {
                    it[nickname] = player.nickname
                    it[playerCode] = player.playerCode
                    it[avatarUrl] = player.avatarUrl
                    it[phoneNumber] = player.phoneNumber?.value
                    it[phoneVerifiedAt] = player.phoneVerifiedAt?.toOffsetDateTime()
                    it[oauthProvider] = player.oauthProvider.name
                    it[oauthSubject] = player.oauthSubject
                    it[drawPointsBalance] = player.drawPointsBalance
                    it[revenuePointsBalance] = player.revenuePointsBalance
                    it[version] = player.version
                    it[xp] = player.xp
                    it[level] = player.level
                    it[tier] = player.tier
                    it[preferredAnimationMode] = player.preferredAnimationMode.name
                    it[locale] = player.locale
                    it[isActive] = player.isActive
                    it[deletedAt] = player.deletedAt?.toOffsetDateTime()
                    it[updatedAt] = player.updatedAt.toOffsetDateTime()
                }
            }

            PlayersTable
                .selectAll()
                .where { PlayersTable.id eq player.id.value }
                .single()
                .toPlayer()
        }

    override suspend fun updateBalance(
        id: PlayerId,
        drawPointsDelta: Int,
        revenuePointsDelta: Int,
        expectedVersion: Int,
    ): Boolean =
        newSuspendedTransaction {
            val updatedRows =
                PlayersTable.update({
                    (PlayersTable.id eq id.value) and (PlayersTable.version eq expectedVersion)
                }) {
                    with(org.jetbrains.exposed.sql.SqlExpressionBuilder) {
                        it[drawPointsBalance] = PlayersTable.drawPointsBalance + drawPointsDelta
                        it[revenuePointsBalance] = PlayersTable.revenuePointsBalance + revenuePointsDelta
                    }
                    it[version] = expectedVersion + 1
                }
            updatedRows > 0
        }

    override suspend fun findAll(
        offset: Int,
        limit: Int,
    ): List<Player> =
        newSuspendedTransaction {
            PlayersTable
                .selectAll()
                .where { PlayersTable.deletedAt.isNull() }
                .orderBy(PlayersTable.createdAt, SortOrder.DESC)
                .limit(limit, offset.toLong())
                .map { it.toPlayer() }
        }

    override suspend fun updateXp(
        id: PlayerId,
        xpDelta: Int,
        newLevel: Int,
        newTier: String,
    ): Int =
        newSuspendedTransaction {
            PlayersTable.update({ PlayersTable.id eq id.value }) {
                with(org.jetbrains.exposed.sql.SqlExpressionBuilder) {
                    it[xp] = PlayersTable.xp + xpDelta
                }
                it[level] = newLevel
                it[tier] = newTier
            }
            // Read back the updated XP value
            PlayersTable
                .selectAll()
                .where { PlayersTable.id eq id.value }
                .single()[PlayersTable.xp]
        }

    override suspend fun findTopByXp(limit: Int): List<Player> =
        newSuspendedTransaction {
            PlayersTable
                .selectAll()
                .where { PlayersTable.deletedAt.isNull() }
                .orderBy(PlayersTable.xp, SortOrder.DESC)
                .limit(limit)
                .map { it.toPlayer() }
        }

    override suspend fun findByPlayerCode(code: String): Player? =
        newSuspendedTransaction {
            PlayersTable
                .selectAll()
                .where {
                    (PlayersTable.playerCode eq code) and
                        (PlayersTable.deletedAt.isNull())
                }.singleOrNull()
                ?.toPlayer()
        }

    override suspend fun findByIds(ids: List<PlayerId>): List<Player> =
        newSuspendedTransaction {
            val uuids = ids.map { it.value }
            PlayersTable
                .selectAll()
                .where {
                    (PlayersTable.id inList uuids) and
                        (PlayersTable.deletedAt.isNull())
                }.map { it.toPlayer() }
        }

    private fun ResultRow.toPlayer(): Player =
        Player(
            id = PlayerId(this[PlayersTable.id]),
            nickname = this[PlayersTable.nickname],
            playerCode = this[PlayersTable.playerCode],
            avatarUrl = this[PlayersTable.avatarUrl],
            phoneNumber = this[PlayersTable.phoneNumber]?.let { PhoneNumber(it) },
            phoneVerifiedAt = this[PlayersTable.phoneVerifiedAt]?.toInstant()?.toKotlinInstant(),
            oauthProvider = OAuthProvider.valueOf(this[PlayersTable.oauthProvider]),
            oauthSubject = this[PlayersTable.oauthSubject],
            drawPointsBalance = this[PlayersTable.drawPointsBalance],
            revenuePointsBalance = this[PlayersTable.revenuePointsBalance],
            version = this[PlayersTable.version],
            xp = this[PlayersTable.xp],
            level = this[PlayersTable.level],
            tier = this[PlayersTable.tier],
            preferredAnimationMode =
                DrawAnimationMode.valueOf(
                    this[PlayersTable.preferredAnimationMode],
                ),
            locale = this[PlayersTable.locale],
            isActive = this[PlayersTable.isActive],
            deletedAt = this[PlayersTable.deletedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[PlayersTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PlayersTable.updatedAt].toInstant().toKotlinInstant(),
        )

    private fun Instant.toOffsetDateTime(): OffsetDateTime = OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)
}
