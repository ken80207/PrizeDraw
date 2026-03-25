package com.prizedraw.application.ports.input.payment

import com.prizedraw.contracts.dto.payment.PaymentIntentDto
import com.prizedraw.domain.valueobjects.PlayerId

/**
 * Input port for initiating a draw-points purchase.
 *
 * Validates the package, creates a PENDING [com.prizedraw.domain.entities.PaymentOrder],
 * and returns a [PaymentIntentDto] containing the gateway checkout URL.
 */
public interface ICreatePaymentOrderUseCase {
    /**
     * Creates a payment order for the requested points package.
     *
     * @param playerId The authenticated player placing the order.
     * @param packageId The ID of the points package to purchase.
     * @return A [PaymentIntentDto] with the payment order ID and checkout URL.
     * @throws com.prizedraw.application.usecases.payment.PackageNotFoundException if no active
     *   package matches [packageId].
     */
    public suspend fun execute(
        playerId: PlayerId,
        packageId: String,
    ): PaymentIntentDto
}
