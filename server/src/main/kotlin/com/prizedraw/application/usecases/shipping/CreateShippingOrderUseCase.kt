package com.prizedraw.application.usecases.shipping

import com.prizedraw.application.ports.input.shipping.ICreateShippingOrderUseCase
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IShippingRepository
import com.prizedraw.contracts.dto.shipping.CreateShippingOrderRequest
import com.prizedraw.contracts.dto.shipping.ShippingOrderDto
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.contracts.enums.ShippingOrderStatus
import com.prizedraw.domain.entities.ShippingOrder
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Clock
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/**
 * Validates prize state, creates a [ShippingOrder], and transitions the prize to
 * PENDING_SHIPMENT — all within one DB transaction.
 */
public class CreateShippingOrderUseCase(
    private val prizeRepository: IPrizeRepository,
    private val shippingRepository: IShippingRepository,
    private val outboxRepository: IOutboxRepository,
) : ICreateShippingOrderUseCase {
    override suspend fun execute(
        playerId: PlayerId,
        request: CreateShippingOrderRequest,
    ): ShippingOrderDto {
        val instanceId = PrizeInstanceId(UUID.fromString(request.prizeInstanceId))
        return newSuspendedTransaction {
            val instance =
                prizeRepository.findInstanceById(instanceId)
                    ?: throw PrizeNotHoldingException("Prize instance $instanceId not found")
            if (instance.ownerId != playerId) {
                throw PrizeNotHoldingException("Prize $instanceId not owned by player")
            }
            if (instance.state != PrizeState.HOLDING) {
                throw PrizeNotHoldingException(
                    "Prize $instanceId must be HOLDING to ship, current state: ${instance.state}",
                )
            }
            val now = Clock.System.now()
            val order =
                ShippingOrder(
                    id = UUID.randomUUID(),
                    playerId = playerId,
                    prizeInstanceId = instanceId,
                    recipientName = request.recipientName,
                    recipientPhone = request.recipientPhone,
                    addressLine1 = request.addressLine1,
                    addressLine2 = request.addressLine2,
                    city = request.city,
                    postalCode = request.postalCode,
                    countryCode = request.countryCode,
                    trackingNumber = null,
                    carrier = null,
                    status = ShippingOrderStatus.PENDING_SHIPMENT,
                    shippedAt = null,
                    deliveredAt = null,
                    cancelledAt = null,
                    fulfilledByStaffId = null,
                    createdAt = now,
                    updatedAt = now,
                )
            val saved = shippingRepository.save(order)
            prizeRepository.updateInstanceState(instanceId, PrizeState.PENDING_SHIPMENT, PrizeState.HOLDING)
            outboxRepository.enqueue(ShippingCreatedEvent(saved.id, playerId.value))
            saved.toDto()
        }
    }
}

internal class ShippingCreatedEvent(
    val orderId: UUID,
    val playerId: UUID,
) : com.prizedraw.application.ports.output.DomainEvent {
    override val eventType: String = "shipping.order.created"
    override val aggregateType: String = "ShippingOrder"
    override val aggregateId: UUID = orderId
}

internal fun ShippingOrder.toDto(): ShippingOrderDto =
    ShippingOrderDto(
        id = id.toString(),
        prizeInstanceId = prizeInstanceId.value.toString(),
        recipientName = recipientName,
        recipientPhone = recipientPhone,
        addressLine1 = addressLine1,
        addressLine2 = addressLine2,
        city = city,
        postalCode = postalCode,
        countryCode = countryCode,
        trackingNumber = trackingNumber,
        carrier = carrier,
        status = status,
        shippedAt = shippedAt,
        deliveredAt = deliveredAt,
    )
