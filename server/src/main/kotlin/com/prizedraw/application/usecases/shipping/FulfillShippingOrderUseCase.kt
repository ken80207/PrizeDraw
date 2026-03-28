package com.prizedraw.application.usecases.shipping

import com.prizedraw.application.ports.input.shipping.IFulfillShippingOrderUseCase
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IShippingRepository
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.contracts.enums.ShippingOrderStatus
import kotlinx.datetime.Clock
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/**
 * Operator fills in the tracking number and marks the order SHIPPED.
 * Enqueues a [ShippingStatusChangedEvent] for push notification delivery.
 */
public class FulfillShippingOrderUseCase(
    private val shippingRepository: IShippingRepository,
    private val prizeRepository: IPrizeRepository,
    private val outboxRepository: IOutboxRepository,
) : IFulfillShippingOrderUseCase {
    override suspend fun execute(
        orderId: UUID,
        trackingNumber: String,
        carrier: String,
        staffId: UUID,
    ): Unit =
        newSuspendedTransaction {
            val order =
                shippingRepository.findById(orderId)
                    ?: throw ShippingNotFoundException("Shipping order $orderId not found")
            if (order.status != ShippingOrderStatus.PENDING_SHIPMENT) {
                throw CancellationNotAllowedException(
                    "Order $orderId cannot be fulfilled in state: ${order.status}",
                )
            }
            val now = Clock.System.now()
            shippingRepository.save(
                order.copy(
                    trackingNumber = trackingNumber,
                    carrier = carrier,
                    status = ShippingOrderStatus.SHIPPED,
                    shippedAt = now,
                    fulfilledByStaffId = staffId,
                    updatedAt = now,
                ),
            )
            prizeRepository.updateInstanceState(
                id = order.prizeInstanceId,
                newState = PrizeState.SHIPPED,
                expectedState = PrizeState.PENDING_SHIPMENT,
            )
            outboxRepository.enqueue(ShippingStatusChangedEvent(orderId, order.playerId.value, "SHIPPED"))
        }
}

internal class ShippingStatusChangedEvent(
    val orderId: UUID,
    val playerId: UUID,
    val newStatus: String,
) : com.prizedraw.application.ports.output.DomainEvent {
    override val eventType: String = "shipping.status_changed"
    override val aggregateType: String = "ShippingOrder"
    override val aggregateId: UUID = orderId
}
