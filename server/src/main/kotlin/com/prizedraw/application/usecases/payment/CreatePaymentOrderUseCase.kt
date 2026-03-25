package com.prizedraw.application.usecases.payment

import com.prizedraw.application.ports.input.payment.ICreatePaymentOrderUseCase
import com.prizedraw.application.ports.output.IPaymentGateway
import com.prizedraw.application.ports.output.IPaymentOrderRepository
import com.prizedraw.contracts.dto.payment.PaymentIntentDto
import com.prizedraw.contracts.enums.PaymentOrderStatus
import com.prizedraw.domain.entities.PaymentOrder
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import org.slf4j.LoggerFactory
import java.util.UUID

/**
 * Creates a PENDING payment order and initiates a payment intent with the gateway.
 *
 * Flow:
 * 1. Look up the requested points package from the hardcoded catalogue.
 * 2. Build and persist a [PaymentOrder] in PENDING state.
 * 3. Call [IPaymentGateway.createPaymentIntent] to obtain a checkout URL.
 * 4. Persist the gateway transaction ID on the order.
 * 5. Return a [PaymentIntentDto] for the client to redirect the player.
 */
public class CreatePaymentOrderUseCase(
    private val paymentOrderRepository: IPaymentOrderRepository,
    private val paymentGateway: IPaymentGateway,
    private val packages: List<PointsPackage> = defaultPointsPackages(),
) : ICreatePaymentOrderUseCase {
    private val log = LoggerFactory.getLogger(CreatePaymentOrderUseCase::class.java)

    override suspend fun execute(
        playerId: PlayerId,
        packageId: String,
    ): PaymentIntentDto {
        val pkg =
            packages.firstOrNull { it.id == packageId && it.isActive }
                ?: throw PackageNotFoundException("Points package '$packageId' not found or inactive")

        val now = Clock.System.now()
        val orderId = UUID.randomUUID()

        val order =
            PaymentOrder(
                id = orderId,
                playerId = playerId,
                fiatAmount = pkg.fiatAmount,
                currencyCode = pkg.currencyCode,
                drawPointsGranted = pkg.drawPointsAmount,
                gateway = pkg.defaultGateway,
                gatewayTransactionId = null,
                paymentMethod = null,
                gatewayMetadata = buildJsonObject {},
                status = PaymentOrderStatus.PENDING,
                paidAt = null,
                failedAt = null,
                refundedAt = null,
                expiresAt = null,
                createdAt = now,
                updatedAt = now,
            )
        paymentOrderRepository.save(order)

        val intentResult = paymentGateway.createPaymentIntent(order)
        log.info("Payment intent created for order {} — gateway txn {}", orderId, intentResult.gatewayTransactionId)

        val updatedOrder =
            paymentOrderRepository.save(
                order.copy(
                    gatewayTransactionId = intentResult.gatewayTransactionId,
                    expiresAt = intentResult.expiresAt,
                    updatedAt = Clock.System.now(),
                ),
            )

        return PaymentIntentDto(
            paymentOrderId = updatedOrder.id.toString(),
            gateway = updatedOrder.gateway,
            checkoutUrl = intentResult.checkoutUrl,
            expiresAt = intentResult.expiresAt,
        )
    }
}
