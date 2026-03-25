package com.prizedraw.application.usecases.coupon

import com.prizedraw.application.ports.input.coupon.IDeactivateCouponUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.ICouponRepository
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.Coupon
import com.prizedraw.domain.valueobjects.StaffId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.util.UUID

/** Thrown when the coupon to deactivate is not found. */
public class CouponNotFoundException(
    couponId: UUID,
) : IllegalArgumentException("Coupon $couponId not found")

/**
 * Deactivates a [Coupon] by setting [Coupon.isActive] to false.
 *
 * Existing [com.prizedraw.domain.entities.PlayerCoupon] instances are unaffected.
 */
public class DeactivateCouponUseCase(
    private val couponRepository: ICouponRepository,
    private val auditRepository: IAuditRepository,
) : IDeactivateCouponUseCase {
    override suspend fun execute(
        actorStaffId: StaffId,
        couponId: UUID,
    ): Coupon {
        val coupon =
            couponRepository.findCouponById(couponId)
                ?: throw CouponNotFoundException(couponId)
        val now = Clock.System.now()
        val updated = coupon.copy(isActive = false, updatedAt = now)
        val saved = couponRepository.saveCoupon(updated)
        auditRepository.record(
            AuditLog(
                id = UUID.randomUUID(),
                actorType = AuditActorType.STAFF,
                actorPlayerId = null,
                actorStaffId = actorStaffId.value,
                action = "coupon.deactivated",
                entityType = "Coupon",
                entityId = couponId,
                beforeValue = buildJsonObject { put("isActive", coupon.isActive) },
                afterValue = buildJsonObject { put("isActive", false) },
                metadata = buildJsonObject { put("actorStaffId", actorStaffId.value.toString()) },
                createdAt = now,
            ),
        )
        return saved
    }
}
