@file:Suppress("MagicNumber")

package com.prizedraw.infrastructure.persistence.tables

import com.prizedraw.domain.entities.CouponApplicableTo
import com.prizedraw.domain.entities.CouponDiscountType
import com.prizedraw.domain.entities.PlayerCouponStatus
import org.jetbrains.exposed.sql.Table
import org.jetbrains.exposed.sql.kotlin.datetime.timestampWithTimeZone

/**
 * Exposed table definitions for the coupon and discount code subsystem.
 *
 * Covers `coupons`, `discount_codes`, and `player_coupons`.
 * Enum columns ([CouponsTable.discountType], [CouponsTable.applicableTo],
 * [PlayerCouponsTable.status]) map to their respective PG enum types via [pgEnum],
 * using the domain-layer enum types that the repository layer depends on.
 */
public object CouponsTable : Table("coupons") {
    public val id = uuid("id").autoGenerate()
    public val name = varchar("name", 128)
    public val description = text("description").nullable()
    public val discountType = pgEnum<CouponDiscountType>("discount_type", "coupon_discount_type")
    public val discountValue = integer("discount_value")
    public val applicableTo =
        pgEnum<CouponApplicableTo>("applicable_to", "coupon_applicable_to")
            .default(CouponApplicableTo.ALL)
    public val maxUsesPerPlayer = integer("max_uses_per_player").default(1)
    public val totalIssued = integer("total_issued").default(0)
    public val totalUsed = integer("total_used").default(0)
    public val issueLimit = integer("issue_limit").nullable()
    public val validFrom = timestampWithTimeZone("valid_from")
    public val validUntil = timestampWithTimeZone("valid_until")
    public val isActive = bool("is_active").default(true)
    public val createdByStaffId = uuid("created_by_staff_id")
    public val deletedAt = timestampWithTimeZone("deleted_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object DiscountCodesTable : Table("discount_codes") {
    public val id = uuid("id").autoGenerate()
    public val couponId = uuid("coupon_id")
    public val code = varchar("code", 64)
    public val redemptionLimit = integer("redemption_limit").nullable()
    public val redemptionCount = integer("redemption_count").default(0)
    public val isActive = bool("is_active").default(true)
    public val deletedAt = timestampWithTimeZone("deleted_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}

public object PlayerCouponsTable : Table("player_coupons") {
    public val id = uuid("id").autoGenerate()
    public val playerId = uuid("player_id")
    public val couponId = uuid("coupon_id")
    public val discountCodeId = uuid("discount_code_id").nullable()
    public val useCount = integer("use_count").default(0)
    public val status =
        pgEnum<PlayerCouponStatus>("status", "player_coupon_status")
            .default(PlayerCouponStatus.ACTIVE)
    public val issuedAt = timestampWithTimeZone("issued_at")
    public val lastUsedAt = timestampWithTimeZone("last_used_at").nullable()
    public val createdAt = timestampWithTimeZone("created_at")
    public val updatedAt = timestampWithTimeZone("updated_at")

    override val primaryKey: PrimaryKey = PrimaryKey(id)
}
