package com.prizedraw.application.usecases.shipping

import com.prizedraw.application.ports.input.shipping.ICancelShippingOrderUseCase
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IShippingRepository
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.contracts.enums.ShippingOrderStatus
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/**
 * Cancels a PENDING_SHIPMENT order and restores the prize instance to HOLDING.
 */
public class CancelShippingOrderUseCase(
    private val shippingRepository: IShippingRepository,
    private val prizeRepository: IPrizeRepository,
) : ICancelShippingOrderUseCase {
    override suspend fun execute(
        playerId: PlayerId,
        orderId: UUID,
    ): Unit =
        newSuspendedTransaction {
            val order =
                shippingRepository.findById(orderId)
                    ?: throw ShippingNotFoundException("Shipping order $orderId not found")
            if (order.playerId != playerId) {
                throw CancellationNotAllowedException("Order $orderId does not belong to player")
            }
            if (order.status != ShippingOrderStatus.PENDING_SHIPMENT) {
                throw CancellationNotAllowedException(
                    "Order $orderId cannot be cancelled in state: ${order.status}",
                )
            }
            val now = Clock.System.now()
            shippingRepository.save(
                order.copy(
                    status = ShippingOrderStatus.CANCELLED,
                    cancelledAt = now,
                    updatedAt = now,
                ),
            )
            prizeRepository.updateInstanceState(
                id = order.prizeInstanceId,
                newState = PrizeState.HOLDING,
                expectedState = PrizeState.PENDING_SHIPMENT,
            )
        }
}
