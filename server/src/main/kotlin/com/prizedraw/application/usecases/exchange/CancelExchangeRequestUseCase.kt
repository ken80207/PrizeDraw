package com.prizedraw.application.usecases.exchange

import com.prizedraw.application.ports.input.exchange.ICancelExchangeRequestUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IExchangeRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.contracts.enums.ExchangeItemSide
import com.prizedraw.contracts.enums.ExchangeRequestStatus
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.valueobjects.PlayerId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/**
 * Cancels an exchange request and restores all EXCHANGING prizes to HOLDING.
 *
 * Only the initiator may cancel a PENDING or COUNTER_PROPOSED request.
 */
public class CancelExchangeRequestUseCase(
    private val exchangeRepository: IExchangeRepository,
    private val prizeRepository: IPrizeRepository,
    private val auditRepository: IAuditRepository,
    private val outboxRepository: IOutboxRepository,
) : ICancelExchangeRequestUseCase {
    override suspend fun execute(
        cancellerId: PlayerId,
        requestId: UUID,
    ): Unit =
        newSuspendedTransaction {
            val request =
                exchangeRepository.findById(requestId)
                    ?: throw ExchangeRequestNotFoundException("Exchange request $requestId not found")
            if (request.initiatorId != cancellerId) {
                throw ExchangeUnauthorizedException("Only the initiator may cancel this exchange request")
            }
            if (request.status != ExchangeRequestStatus.PENDING &&
                request.status != ExchangeRequestStatus.COUNTER_PROPOSED
            ) {
                throw ExchangeNotPendingException(
                    "Cannot cancel a request in state: ${request.status}",
                )
            }
            val now = Clock.System.now()
            val items = exchangeRepository.findItemsByRequest(requestId)
            items.filter { it.side == ExchangeItemSide.INITIATOR }.forEach { item ->
                prizeRepository.updateInstanceState(item.prizeInstanceId, PrizeState.HOLDING, PrizeState.EXCHANGING)
            }
            val cancelled =
                request.copy(
                    status = ExchangeRequestStatus.CANCELLED,
                    cancelledAt = now,
                    updatedAt = now,
                )
            exchangeRepository.save(cancelled)
            auditRepository.record(
                AuditLog(
                    id = UUID.randomUUID(),
                    actorType = AuditActorType.PLAYER,
                    actorPlayerId = cancellerId,
                    actorStaffId = null,
                    action = "exchange.request.cancelled",
                    entityType = "ExchangeRequest",
                    entityId = requestId,
                    beforeValue = buildJsonObject { put("status", ExchangeRequestStatus.PENDING.name) },
                    afterValue = buildJsonObject { put("status", ExchangeRequestStatus.CANCELLED.name) },
                    metadata = kotlinx.serialization.json.buildJsonObject { },
                    createdAt = now,
                ),
            )
            outboxRepository.enqueue(ExchangeCancelledEvent(requestId, request.recipientId.value))
        }
}

internal class ExchangeCancelledEvent(
    val requestId: UUID,
    val recipientId: UUID,
) : com.prizedraw.application.ports.output.DomainEvent {
    override val eventType: String = "exchange.request.cancelled"
    override val aggregateType: String = "ExchangeRequest"
    override val aggregateId: UUID = requestId
}
