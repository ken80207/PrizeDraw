package com.prizedraw.application.usecases.payment

import com.prizedraw.contracts.dto.payment.PointsPackageDto
import com.prizedraw.contracts.enums.PaymentGateway

/**
 * Hardcoded points package definitions.
 *
 * In a production system these would be loaded from a `points_packages` database table
 * managed via the admin back-office. The hardcoded catalogue here is suitable for
 * development and initial launch with a fixed SKU list.
 *
 * @property id Stable package identifier used in API requests and payment orders.
 * @property drawPointsAmount Draw points credited to the player on successful payment.
 * @property fiatAmount Charge amount in the smallest currency unit (TWD has no sub-units).
 * @property currencyCode ISO 4217 currency code.
 * @property label Human-readable display name.
 * @property isActive Whether this package is available for purchase.
 * @property defaultGateway The payment gateway to use for this package.
 */
public data class PointsPackage(
    val id: String,
    val drawPointsAmount: Int,
    val fiatAmount: Int,
    val currencyCode: String,
    val label: String,
    val isActive: Boolean,
    val defaultGateway: PaymentGateway,
)

/**
 * Returns the hardcoded points package catalogue.
 *
 * Fiat amounts reflect promotional discount pricing (TWD, no sub-units):
 * - 100 pts = TWD 100 (no discount)
 * - 500 pts = TWD 450 (10% bonus)
 * - 1,000 pts = TWD 850 (15% bonus)
 * - 3,000 pts = TWD 2,400 (20% bonus)
 * - 5,000 pts = TWD 3,750 (25% bonus)
 */
@Suppress("MagicNumber")
public fun defaultPointsPackages(): List<PointsPackage> =
    listOf(
        PointsPackage("pkg_100", 100, 100, "TWD", "100 Points", true, PaymentGateway.ECPAY),
        PointsPackage("pkg_500", 500, 450, "TWD", "500 Points (10% bonus)", true, PaymentGateway.ECPAY),
        PointsPackage("pkg_1000", 1_000, 850, "TWD", "1,000 Points (15% bonus)", true, PaymentGateway.ECPAY),
        PointsPackage("pkg_3000", 3_000, 2_400, "TWD", "3,000 Points (20% bonus)", true, PaymentGateway.ECPAY),
        PointsPackage("pkg_5000", 5_000, 3_750, "TWD", "5,000 Points (25% bonus)", true, PaymentGateway.ECPAY),
    )

/** Maps a [PointsPackage] to its public [PointsPackageDto]. */
public fun PointsPackage.toDto(): PointsPackageDto =
    PointsPackageDto(
        id = id,
        drawPointsAmount = drawPointsAmount,
        fiatAmount = fiatAmount,
        currencyCode = currencyCode,
        label = label,
        isActive = isActive,
    )
