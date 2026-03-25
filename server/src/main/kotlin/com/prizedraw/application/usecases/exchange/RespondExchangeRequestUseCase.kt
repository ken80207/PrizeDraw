package com.prizedraw.application.usecases.exchange

import com.prizedraw.application.ports.input.exchange.IRespondExchangeRequestUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IExchangeRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.contracts.dto.exchange.ExchangeOfferDto
import com.prizedraw.contracts.dto.exchange.ExchangeResponseAction
import com.prizedraw.contracts.dto.exchange.RespondExchangeRequest
import com.prizedraw.contracts.enums.ExchangeItemSide
import com.prizedraw.contracts.enums.ExchangeRequestStatus
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.domain.entities.AuditActorType
import com.prizedraw.domain.entities.AuditLog
import com.prizedraw.domain.entities.ExchangeRequest
import com.prizedraw.domain.entities.ExchangeRequestItem
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.domain.valueobjects.PrizeInstanceId
import kotlinx.datetime.Clock
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import java.util.UUID

/**
 * Processes a response (ACCEPT, REJECT, or COUNTER_PROPOSE) to an exchange request.
 *
 * ACCEPT: atomically transfers all items between parties, marks originals RECYCLED, status COMPLETED.
 * REJECT: restores initiator items to HOLDING, status REJECTED.
 * COUNTER_PROPOSE: creates a new child request (swapped roles), locks recipient's offered items.
 */
public class RespondExchangeRequestUseCase(
    private val exchangeRepository: IExchangeRepository,
    private val prizeRepository: IPrizeRepository,
    private val playerRepository: IPlayerRepository,
    private val auditRepository: IAuditRepository,
    private val outboxRepository: IOutboxRepository,
) : IRespondExchangeRequestUseCase {
    override suspend fun execute(
        responderId: PlayerId,
        requestId: UUID,
        response: RespondExchangeRequest,
    ): ExchangeOfferDto =
        newSuspendedTransaction {
            val request =
                exchangeRepository.findById(requestId)
                    ?: throw ExchangeRequestNotFoundException("Exchange request $requestId not found")
            if (request.recipientId != responderId) {
                throw ExchangeUnauthorizedException("Only the recipient may respond to this request")
            }
            if (request.status != ExchangeRequestStatus.PENDING &&
                request.status != ExchangeRequestStatus.COUNTER_PROPOSED
            ) {
                throw ExchangeNotPendingException("Exchange request is not in a respondable state: ${request.status}")
            }
            val items = exchangeRepository.findItemsByRequest(requestId)
            val now = Clock.System.now()
            val updated =
                when (response.action) {
                    ExchangeResponseAction.ACCEPT -> handleAccept(request, items, now)
                    ExchangeResponseAction.REJECT -> handleReject(request, items, now)
                    ExchangeResponseAction.COUNTER_PROPOSE ->
                        handleCounterPropose(
                            request,
                            items,
                            response,
                            responderId,
                            now,
                        )
                }
            recordAudit(responderId, updated, response.action, auditRepository, now)
            buildResponseDto(updated, items, playerRepository, prizeRepository, exchangeRepository, requestId)
        }

    private suspend fun handleAccept(
        request: ExchangeRequest,
        items: List<ExchangeRequestItem>,
        now: kotlinx.datetime.Instant,
    ): ExchangeRequest {
        val initiatorItems = items.filter { it.side == ExchangeItemSide.INITIATOR }
        val recipientItems = items.filter { it.side == ExchangeItemSide.RECIPIENT }
        initiatorItems.forEach { item ->
            prizeRepository.transferOwnership(item.prizeInstanceId, request.recipientId, PrizeState.HOLDING)
        }
        recipientItems.forEach { item ->
            prizeRepository.transferOwnership(item.prizeInstanceId, request.initiatorId, PrizeState.HOLDING)
        }
        val completed =
            request.copy(
                status = ExchangeRequestStatus.COMPLETED,
                respondedAt = now,
                completedAt = now,
                updatedAt = now,
            )
        return exchangeRepository.save(completed)
    }

    private suspend fun handleReject(
        request: ExchangeRequest,
        items: List<ExchangeRequestItem>,
        now: kotlinx.datetime.Instant,
    ): ExchangeRequest {
        items.filter { it.side == ExchangeItemSide.INITIATOR }.forEach { item ->
            prizeRepository.updateInstanceState(item.prizeInstanceId, PrizeState.HOLDING, PrizeState.EXCHANGING)
        }
        val rejected =
            request.copy(
                status = ExchangeRequestStatus.REJECTED,
                respondedAt = now,
                updatedAt = now,
            )
        return exchangeRepository.save(rejected)
    }

    @Suppress("LongParameterList")
    private suspend fun handleCounterPropose(
        request: ExchangeRequest,
        existingItems: List<ExchangeRequestItem>,
        response: RespondExchangeRequest,
        responderId: PlayerId,
        now: kotlinx.datetime.Instant,
    ): ExchangeRequest {
        val counterIds =
            response.counterOfferedPrizeInstanceIds
                ?: throw ExchangeNotPendingException("Counter-propose requires counterOfferedPrizeInstanceIds")
        require(counterIds.isNotEmpty()) { "Counter-propose must offer at least one prize" }
        counterIds.forEach { id ->
            val instanceId = PrizeInstanceId(UUID.fromString(id))
            val instance =
                prizeRepository.findInstanceById(instanceId)
                    ?: throw PrizeNotAvailableForExchangeException("Counter prize $id not found")
            if (instance.ownerId != responderId) {
                throw PrizeNotAvailableForExchangeException("Counter prize $id not owned by responder")
            }
            if (instance.state != PrizeState.HOLDING) {
                throw PrizeNotAvailableForExchangeException(
                    "Counter prize $id must be HOLDING, current: ${instance.state}",
                )
            }
        }
        val parentUpdated =
            request.copy(
                status = ExchangeRequestStatus.COUNTER_PROPOSED,
                respondedAt = now,
                updatedAt = now,
            )
        exchangeRepository.save(parentUpdated)
        val childRequest =
            ExchangeRequest(
                id = UUID.randomUUID(),
                initiatorId = responderId,
                recipientId = request.initiatorId,
                parentRequestId = request.id,
                status = ExchangeRequestStatus.PENDING,
                message = null,
                respondedAt = null,
                completedAt = null,
                cancelledAt = null,
                createdAt = now,
                updatedAt = now,
            )
        val childSaved = exchangeRepository.save(childRequest)
        val originalRecipientItems =
            existingItems
                .filter { it.side == ExchangeItemSide.RECIPIENT }
                .map { it.prizeInstanceId.value.toString() }
        val childItems =
            buildChildItems(childSaved.id, counterIds, ExchangeItemSide.INITIATOR, now) +
                buildChildItems(childSaved.id, originalRecipientItems, ExchangeItemSide.RECIPIENT, now)
        exchangeRepository.saveItems(childItems)
        counterIds.forEach { id ->
            prizeRepository.updateInstanceState(
                PrizeInstanceId(UUID.fromString(id)),
                PrizeState.EXCHANGING,
                PrizeState.HOLDING,
            )
        }
        outboxRepository.enqueue(ExchangeCreatedEvent(childSaved.id, request.initiatorId.value))
        return parentUpdated
    }

    private fun buildChildItems(
        requestId: UUID,
        ids: List<String>,
        side: ExchangeItemSide,
        now: kotlinx.datetime.Instant,
    ) = ids.map { id ->
        ExchangeRequestItem(
            id = UUID.randomUUID(),
            exchangeRequestId = requestId,
            prizeInstanceId = PrizeInstanceId(UUID.fromString(id)),
            side = side,
            createdAt = now,
        )
    }
}

private fun recordAudit(
    responderId: PlayerId,
    request: ExchangeRequest,
    action: ExchangeResponseAction,
    auditRepository: IAuditRepository,
    now: kotlinx.datetime.Instant,
) {
    auditRepository.record(
        AuditLog(
            id = UUID.randomUUID(),
            actorType = AuditActorType.PLAYER,
            actorPlayerId = responderId,
            actorStaffId = null,
            action = "exchange.request.${action.name.lowercase()}",
            entityType = "ExchangeRequest",
            entityId = request.id,
            beforeValue = kotlinx.serialization.json.buildJsonObject { },
            afterValue = buildJsonObject { put("status", request.status.name) },
            metadata = kotlinx.serialization.json.buildJsonObject { },
            createdAt = now,
        ),
    )
}

private suspend fun buildResponseDto(
    updated: ExchangeRequest,
    items: List<ExchangeRequestItem>,
    playerRepository: IPlayerRepository,
    prizeRepository: IPrizeRepository,
    exchangeRepository: IExchangeRepository,
    originalRequestId: UUID,
): ExchangeOfferDto {
    val allItems =
        if (updated.id != originalRequestId) {
            exchangeRepository.findItemsByRequest(updated.id)
        } else {
            items
        }
    val initiator = playerRepository.findById(updated.initiatorId)!!
    val recipient = playerRepository.findById(updated.recipientId)!!
    val instances =
        allItems
            .mapNotNull { item ->
                prizeRepository
                    .findInstanceById(item.prizeInstanceId)
                    ?.let { item.prizeInstanceId.value.toString() to it }
            }.toMap()
    val definitions =
        instances.values
            .mapNotNull { prizeRepository.findDefinitionById(it.prizeDefinitionId) }
            .associateBy { it.id.value.toString() }
    return updated.toDto(initiator, recipient, allItems, instances, definitions)
}
