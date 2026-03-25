package com.prizedraw.application.ports.output

import com.prizedraw.domain.entities.Coupon
import com.prizedraw.domain.entities.DiscountCode
import com.prizedraw.domain.entities.PlayerCoupon
import com.prizedraw.domain.entities.PlayerCouponStatus
import com.prizedraw.domain.valueobjects.PlayerId
import java.util.UUID

/**
 * Output port for persisting and querying [Coupon], [DiscountCode], and [PlayerCoupon] entities.
 */
public interface ICouponRepository {
    // --- Coupon ---

    /**
     * Finds a [Coupon] by its surrogate primary key.
     *
     * Soft-deleted coupons are excluded.
     *
     * @param id The coupon identifier.
     * @return The matching [Coupon], or null if not found.
     */
    public suspend fun findCouponById(id: UUID): Coupon?

    /**
     * Returns all currently active and non-expired coupons.
     *
     * @return List of active coupons.
     */
    public suspend fun findActiveCoupons(): List<Coupon>

    /**
     * Persists a [Coupon] entity (insert or update).
     *
     * @param coupon The coupon to persist.
     * @return The persisted coupon.
     */
    public suspend fun saveCoupon(coupon: Coupon): Coupon

    // --- Discount Code ---

    /**
     * Finds a [DiscountCode] by its case-insensitive code string.
     *
     * Soft-deleted codes are excluded.
     *
     * @param code The redemption code (case-insensitive lookup).
     * @return The matching [DiscountCode], or null if not found.
     */
    public suspend fun findDiscountCodeByCode(code: String): DiscountCode?

    /**
     * Persists a [DiscountCode] entity (insert or update).
     *
     * @param code The discount code to persist.
     * @return The persisted discount code.
     */
    public suspend fun saveDiscountCode(code: DiscountCode): DiscountCode

    // --- Player Coupon ---

    /**
     * Finds a [PlayerCoupon] by its surrogate primary key.
     *
     * @param id The player coupon identifier.
     * @return The matching [PlayerCoupon], or null if not found.
     */
    public suspend fun findPlayerCouponById(id: UUID): PlayerCoupon?

    /**
     * Returns all [PlayerCoupon]s in the given player's wallet, optionally filtered by status.
     *
     * @param playerId The player's identifier.
     * @param status When non-null, restricts results to this status.
     * @return List of player coupons in the wallet.
     */
    public suspend fun findPlayerCoupons(
        playerId: PlayerId,
        status: PlayerCouponStatus? = null,
    ): List<PlayerCoupon>

    /**
     * Persists a [PlayerCoupon] entity (insert or update).
     *
     * @param playerCoupon The player coupon to persist.
     * @return The persisted player coupon.
     */
    public suspend fun savePlayerCoupon(playerCoupon: PlayerCoupon): PlayerCoupon
}
