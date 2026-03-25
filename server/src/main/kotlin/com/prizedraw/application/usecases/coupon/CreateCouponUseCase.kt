package com.prizedraw.application.usecases.coupon

import com.prizedraw.application.ports.input.coupon.CreateCouponParams
import com.prizedraw.application.ports.input.coupon.CreateCouponResult
import com.prizedraw.application.ports.input.coupon.ICreateCouponUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICouponRepository
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.Coupon
import com.prizedraw.domain.entities.CouponDiscountType
import com.prizedraw.domain.entities.DiscountCode
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

private const val MAX_PERCENTAGE_DISCOUNT = 99

/** Thrown when coupon validity period is invalid (validFrom >= validUntil). */
public class InvalidCouponValidityException(
    from: Instant,
    until: Instant,
) : IllegalArgumentException("validFrom ($from) must be before validUntil ($until)")

/** Thrown when the discount value is out of range for the chosen discount type. */
public class InvalidDiscountValueException(
    type: CouponDiscountType,
    value: Int,
) : IllegalArgumentException("Discount value $value is invalid for $type")

/**
 * Creates a [Coupon] template and optionally a linked [DiscountCode].
 *
 * Validates:
 * - [discountValue] is 1–99 for PERCENTAGE type; positive integer for FIXED_POINTS.
 * - [validFrom] < [validUntil].
 * - [maxUsesPerPlayer] >= 1.
 */
public class CreateCouponUseCase(
    private val couponRepository: ICouponRepository,
    private val auditRepository: IAuditRepository,
) : ICreateCouponUseCase {
    override suspend fun execute(params: CreateCouponParams): CreateCouponResult {
        validateDiscountValue(params.discountType, params.discountValue)
        if (params.validFrom >= params.validUntil) {
            throw InvalidCouponValidityException(params.validFrom, params.validUntil)
        }
        require(params.maxUsesPerPlayer >= 1) { "maxUsesPerPlayer must be >= 1" }
        val now = Clock.System.now()
        val couponId = UUID.randomUUID()
        val savedCoupon = couponRepository.saveCoupon(buildCoupon(couponId, params, now))
        val savedCode =
            saveDiscountCodeIfPresent(
                params.discountCode,
                params.codeRedemptionLimit,
                couponId,
                now,
            )
        recordCreationAudit(
            params.actorStaffId,
            params.name,
            params.discountType,
            params.discountValue,
            couponId,
            now,
        )
        return CreateCouponResult(coupon = savedCoupon, discountCode = savedCode)
    }

    private fun buildCoupon(
        couponId: UUID,
        params: CreateCouponParams,
        now: kotlinx.datetime.Instant,
    ): Coupon =
        Coupon(
            id = couponId,
            name = params.name,
            description = params.description,
            discountType = params.discountType,
            discountValue = params.discountValue,
            applicableTo = params.applicableTo,
            maxUsesPerPlayer = params.maxUsesPerPlayer,
            totalIssued = 0,
            totalUsed = 0,
            issueLimit = params.issueLimit,
            validFrom = params.validFrom,
            validUntil = params.validUntil,
            isActive = true,
            createdByStaffId = params.actorStaffId.value,
            deletedAt = null,
            createdAt = now,
            updatedAt = now,
        )

    private suspend fun saveDiscountCodeIfPresent(
        discountCode: String?,
        codeRedemptionLimit: Int?,
        couponId: UUID,
        now: kotlinx.datetime.Instant,
    ): DiscountCode? =
        discountCode?.takeIf { it.isNotBlank() }?.let { rawCode ->
            couponRepository.saveDiscountCode(
                DiscountCode(
                    id = UUID.randomUUID(),
                    couponId = couponId,
                    code = rawCode.uppercase().trim(),
                    redemptionLimit = codeRedemptionLimit,
                    redemptionCount = 0,
                    isActive = true,
                    deletedAt = null,
                    createdAt = now,
                    updatedAt = now,
                ),
            )
        }

    private fun recordCreationAudit(
        actorStaffId: StaffId,
        name: String,
        discountType: CouponDiscountType,
        discountValue: Int,
        couponId: UUID,
        now: kotlinx.datetime.Instant,
    ) {
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = actorStaffId.value,
                action = "coupon.created",
                entityType = "Coupon",
                entityId = couponId,
                beforeValue = null,
                afterValue =
                    buildJsonObject {
                        put("name", name)
                        put("discountType", discountType.name)
                        put("discountValue", discountValue)
                    },
                metadata = buildJsonObject { put("actorStaffId", actorStaffId.value.toString()) },
                createdAt = now,
            ),
        )
    }

    private fun validateDiscountValue(
        discountType: CouponDiscountType,
        discountValue: Int,
    ) {
        when (discountType) {
            CouponDiscountType.PERCENTAGE -> {
                if (discountValue !in 1..MAX_PERCENTAGE_DISCOUNT) {
                    throw InvalidDiscountValueException(discountType, discountValue)
                }
            }
            CouponDiscountType.FIXED_POINTS -> {
                if (discountValue < 1) {
                    throw InvalidDiscountValueException(discountType, discountValue)
                }
            }
        }
    }
}
