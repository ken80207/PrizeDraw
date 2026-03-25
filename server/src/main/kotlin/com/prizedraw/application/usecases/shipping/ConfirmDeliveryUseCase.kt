package com.prizedraw.application.usecases.shipping

import com.prizedraw.application.ports.input.shipping.IConfirmDeliveryUseCase
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IShippingRepository
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.contracts.enums.ShippingOrderStatus
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/**
 * Marks a SHIPPED order as DELIVERED.
 *
 * Can be triggered by player confirmation or by the scheduled auto-confirm job.
 * When [playerId] is non-null, validates that the order belongs to that player.
 */
public class ConfirmDeliveryUseCase(
    private val shippingRepository: IShippingRepository,
    private val prizeRepository: IPrizeRepository,
) : IConfirmDeliveryUseCase {
    override suspend fun execute(
        orderId: UUID,
        playerId: PlayerId?,
    ): Unit =
        newSuspendedTransaction {
            val order =
                shippingRepository.findById(orderId)
                    ?: throw ShippingNotFoundException("Shipping order $orderId not found")
            if (playerId != null && order.playerId != playerId) {
                throw CancellationNotAllowedException("Order $orderId does not belong to player")
            }
            if (order.status != ShippingOrderStatus.SHIPPED) {
                throw CancellationNotAllowedException(
                    "Order $orderId cannot be confirmed in state: ${order.status}",
                )
            }
            val now = Clock.System.now()
            shippingRepository.save(
                order.copy(
                    status = ShippingOrderStatus.DELIVERED,
                    deliveredAt = now,
                    updatedAt = now,
                ),
            )
            prizeRepository.updateInstanceState(
                id = order.prizeInstanceId,
                newState = PrizeState.DELIVERED,
                expectedState = PrizeState.SHIPPED,
            )
        }
}
