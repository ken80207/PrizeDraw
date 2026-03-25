package com.prizedraw.infrastructure.persistence.repositories

import com.prizedraw.application.ports.output.ICouponRepository
import com.prizedraw.domain.entities.Coupon
import com.prizedraw.domain.entities.CouponApplicableTo
import com.prizedraw.domain.entities.CouponDiscountType
import com.prizedraw.domain.entities.DiscountCode
import com.prizedraw.domain.entities.PlayerCoupon
import com.prizedraw.domain.entities.PlayerCouponStatus
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.infrastructure.persistence.tables.CouponsTable
import com.prizedraw.infrastructure.persistence.tables.DiscountCodesTable
import com.prizedraw.infrastructure.persistence.tables.PlayerCouponsTable
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

public class CouponRepositoryImpl : ICouponRepository {
    // --- Coupon ---

    override suspend fun findCouponById(id: UUID): Coupon? =
        newSuspendedTransaction {
            CouponsTable
                .selectAll()
                .where { (CouponsTable.id eq id) and (CouponsTable.deletedAt.isNull()) }
                .singleOrNull()
                ?.toCoupon()
        }

    override suspend fun findActiveCoupons(): List<Coupon> =
        newSuspendedTransaction {
            val now = OffsetDateTime.now(ZoneOffset.UTC)
            CouponsTable
                .selectAll()
                .where {
                    (CouponsTable.isActive eq true) and
                        (CouponsTable.deletedAt.isNull()) and
                        (CouponsTable.validFrom lessEq now) and
                        (CouponsTable.validUntil greaterEq now)
                }.map { it.toCoupon() }
        }

    override suspend fun saveCoupon(coupon: Coupon): Coupon =
        newSuspendedTransaction {
            val existing = CouponsTable.selectAll().where { CouponsTable.id eq coupon.id }.singleOrNull()
            if (existing == null) {
                CouponsTable.insert {
                    it[id] = coupon.id
                    it[name] = coupon.name
                    it[description] = coupon.description
                    it[discountType] = coupon.discountType.name
                    it[discountValue] = coupon.discountValue
                    it[applicableTo] = coupon.applicableTo.name
                    it[maxUsesPerPlayer] = coupon.maxUsesPerPlayer
                    it[totalIssued] = coupon.totalIssued
                    it[totalUsed] = coupon.totalUsed
                    it[issueLimit] = coupon.issueLimit
                    it[validFrom] = coupon.validFrom.toOffsetDateTime()
                    it[validUntil] = coupon.validUntil.toOffsetDateTime()
                    it[isActive] = coupon.isActive
                    it[createdByStaffId] = coupon.createdByStaffId
                    it[deletedAt] = coupon.deletedAt?.toOffsetDateTime()
                    it[createdAt] = coupon.createdAt.toOffsetDateTime()
                    it[updatedAt] = coupon.updatedAt.toOffsetDateTime()
                }
            } else {
                CouponsTable.update({ CouponsTable.id eq coupon.id }) {
                    it[name] = coupon.name
                    it[description] = coupon.description
                    it[totalIssued] = coupon.totalIssued
                    it[totalUsed] = coupon.totalUsed
                    it[isActive] = coupon.isActive
                    it[deletedAt] = coupon.deletedAt?.toOffsetDateTime()
                    it[updatedAt] = coupon.updatedAt.toOffsetDateTime()
                }
            }
            CouponsTable
                .selectAll()
                .where { CouponsTable.id eq coupon.id }
                .single()
                .toCoupon()
        }

    // --- Discount Code ---

    override suspend fun findDiscountCodeByCode(code: String): DiscountCode? =
        newSuspendedTransaction {
            DiscountCodesTable
                .selectAll()
                .where {
                    (DiscountCodesTable.code eq code.uppercase()) and
                        (DiscountCodesTable.deletedAt.isNull())
                }.singleOrNull()
                ?.toDiscountCode()
        }

    override suspend fun saveDiscountCode(code: DiscountCode): DiscountCode =
        newSuspendedTransaction {
            val existing =
                DiscountCodesTable
                    .selectAll()
                    .where { DiscountCodesTable.id eq code.id }
                    .singleOrNull()

            if (existing == null) {
                DiscountCodesTable.insert {
                    it[id] = code.id
                    it[couponId] = code.couponId
                    it[DiscountCodesTable.code] = code.code.uppercase()
                    it[redemptionLimit] = code.redemptionLimit
                    it[redemptionCount] = code.redemptionCount
                    it[isActive] = code.isActive
                    it[deletedAt] =
                        code.deletedAt?.let { i -> OffsetDateTime.ofInstant(i.toJavaInstant(), ZoneOffset.UTC) }
                    it[createdAt] = OffsetDateTime.ofInstant(code.createdAt.toJavaInstant(), ZoneOffset.UTC)
                    it[updatedAt] = OffsetDateTime.ofInstant(code.updatedAt.toJavaInstant(), ZoneOffset.UTC)
                }
            } else {
                DiscountCodesTable.update({ DiscountCodesTable.id eq code.id }) {
                    it[redemptionCount] = code.redemptionCount
                    it[isActive] = code.isActive
                    it[deletedAt] =
                        code.deletedAt?.let { i -> OffsetDateTime.ofInstant(i.toJavaInstant(), ZoneOffset.UTC) }
                    it[updatedAt] = OffsetDateTime.ofInstant(code.updatedAt.toJavaInstant(), ZoneOffset.UTC)
                }
            }
            DiscountCodesTable
                .selectAll()
                .where { DiscountCodesTable.id eq code.id }
                .single()
                .toDiscountCode()
        }

    // --- Player Coupon ---

    override suspend fun findPlayerCouponById(id: UUID): PlayerCoupon? =
        newSuspendedTransaction {
            PlayerCouponsTable
                .selectAll()
                .where { PlayerCouponsTable.id eq id }
                .singleOrNull()
                ?.toPlayerCoupon()
        }

    override suspend fun findPlayerCoupons(
        playerId: PlayerId,
        status: PlayerCouponStatus?,
    ): List<PlayerCoupon> =
        newSuspendedTransaction {
            PlayerCouponsTable
                .selectAll()
                .where {
                    val base = PlayerCouponsTable.playerId eq playerId.value
                    if (status != null) {
                        base and (PlayerCouponsTable.status eq status.name)
                    } else {
                        base
                    }
                }.map { it.toPlayerCoupon() }
        }

    override suspend fun savePlayerCoupon(playerCoupon: PlayerCoupon): PlayerCoupon =
        newSuspendedTransaction {
            val existing =
                PlayerCouponsTable
                    .selectAll()
                    .where { PlayerCouponsTable.id eq playerCoupon.id }
                    .singleOrNull()

            if (existing == null) {
                PlayerCouponsTable.insert {
                    it[id] = playerCoupon.id
                    it[playerId] = playerCoupon.playerId.value
                    it[couponId] = playerCoupon.couponId
                    it[discountCodeId] = playerCoupon.discountCodeId
                    it[useCount] = playerCoupon.useCount
                    it[status] = playerCoupon.status.name
                    it[issuedAt] = playerCoupon.issuedAt.toOffsetDateTime()
                    it[lastUsedAt] = playerCoupon.lastUsedAt?.toOffsetDateTime()
                    it[createdAt] = playerCoupon.createdAt.toOffsetDateTime()
                    it[updatedAt] = playerCoupon.updatedAt.toOffsetDateTime()
                }
            } else {
                PlayerCouponsTable.update({ PlayerCouponsTable.id eq playerCoupon.id }) {
                    it[useCount] = playerCoupon.useCount
                    it[status] = playerCoupon.status.name
                    it[lastUsedAt] = playerCoupon.lastUsedAt?.toOffsetDateTime()
                    it[updatedAt] = playerCoupon.updatedAt.toOffsetDateTime()
                }
            }
            PlayerCouponsTable
                .selectAll()
                .where { PlayerCouponsTable.id eq playerCoupon.id }
                .single()
                .toPlayerCoupon()
        }

    private fun ResultRow.toCoupon(): Coupon =
        Coupon(
            id = this[CouponsTable.id],
            name = this[CouponsTable.name],
            description = this[CouponsTable.description],
            discountType = CouponDiscountType.valueOf(this[CouponsTable.discountType]),
            discountValue = this[CouponsTable.discountValue],
            applicableTo = CouponApplicableTo.valueOf(this[CouponsTable.applicableTo]),
            maxUsesPerPlayer = this[CouponsTable.maxUsesPerPlayer],
            totalIssued = this[CouponsTable.totalIssued],
            totalUsed = this[CouponsTable.totalUsed],
            issueLimit = this[CouponsTable.issueLimit],
            validFrom = this[CouponsTable.validFrom].toInstant().toKotlinInstant(),
            validUntil = this[CouponsTable.validUntil].toInstant().toKotlinInstant(),
            isActive = this[CouponsTable.isActive],
            createdByStaffId = this[CouponsTable.createdByStaffId],
            deletedAt = this[CouponsTable.deletedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[CouponsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[CouponsTable.updatedAt].toInstant().toKotlinInstant(),
        )

    private fun ResultRow.toDiscountCode(): DiscountCode =
        DiscountCode(
            id = this[DiscountCodesTable.id],
            couponId = this[DiscountCodesTable.couponId],
            code = this[DiscountCodesTable.code],
            redemptionLimit = this[DiscountCodesTable.redemptionLimit],
            redemptionCount = this[DiscountCodesTable.redemptionCount],
            isActive = this[DiscountCodesTable.isActive],
            deletedAt = this[DiscountCodesTable.deletedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[DiscountCodesTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[DiscountCodesTable.updatedAt].toInstant().toKotlinInstant(),
        )

    private fun ResultRow.toPlayerCoupon(): PlayerCoupon =
        PlayerCoupon(
            id = this[PlayerCouponsTable.id],
            playerId = PlayerId(this[PlayerCouponsTable.playerId]),
            couponId = this[PlayerCouponsTable.couponId],
            discountCodeId = this[PlayerCouponsTable.discountCodeId],
            useCount = this[PlayerCouponsTable.useCount],
            status = PlayerCouponStatus.valueOf(this[PlayerCouponsTable.status]),
            issuedAt = this[PlayerCouponsTable.issuedAt].toInstant().toKotlinInstant(),
            lastUsedAt = this[PlayerCouponsTable.lastUsedAt]?.toInstant()?.toKotlinInstant(),
            createdAt = this[PlayerCouponsTable.createdAt].toInstant().toKotlinInstant(),
            updatedAt = this[PlayerCouponsTable.updatedAt].toInstant().toKotlinInstant(),
        )
}

private fun kotlinx.datetime.Instant.toOffsetDateTime(): OffsetDateTime =
    OffsetDateTime.ofInstant(toJavaInstant(), ZoneOffset.UTC)
