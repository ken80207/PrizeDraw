package com.prizedraw.application.usecases.exchange

import com.prizedraw.application.ports.input.exchange.ICreateExchangeRequestUseCase
import com.prizedraw.application.ports.output.IAuditRepository
import com.prizedraw.application.ports.output.IExchangeRepository
import com.prizedraw.application.ports.output.IFeatureFlagRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.contracts.dto.exchange.CreateExchangeRequest
import com.prizedraw.contracts.dto.exchange.ExchangeOfferDto
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

private const val EXCHANGE_FEATURE_FLAG = "exchange_feature"

/**
 * Creates a new exchange request between two players.
 *
 * Transaction steps:
 * 1. Check `exchange_feature` flag.
 * 2. Validate initiator prizes are HOLDING and owned by initiator.
 * 3. Validate recipient prizes are HOLDING and owned by recipient.
 * 4. Create [ExchangeRequest] (PENDING) + [ExchangeRequestItem] rows.
 * 5. Transition initiator prizes to EXCHANGING.
 * 6. Enqueue push notification outbox event.
 */
public class CreateExchangeRequestUseCase(
    private val exchangeRepository: IExchangeRepository,
    private val prizeRepository: IPrizeRepository,
    private val playerRepository: IPlayerRepository,
    private val featureFlagRepository: IFeatureFlagRepository,
    private val auditRepository: IAuditRepository,
    private val outboxRepository: IOutboxRepository,
) : ICreateExchangeRequestUseCase {
    override suspend fun execute(
        initiatorId: PlayerId,
        request: CreateExchangeRequest,
    ): ExchangeOfferDto {
        if (!featureFlagRepository.isEnabled(EXCHANGE_FEATURE_FLAG)) {
            throw FeatureDisabledException("Exchange feature is currently disabled")
        }
        require(request.offeredPrizeInstanceIds.isNotEmpty()) { "Must offer at least one prize" }
        require(request.requestedPrizeInstanceIds.isNotEmpty()) { "Must request at least one prize" }
        val recipientId = PlayerId(UUID.fromString(request.recipientId))
        return newSuspendedTransaction {
            val recipient =
                playerRepository.findById(recipientId)
                    ?: throw ExchangeRequestNotFoundException("Recipient ${request.recipientId} not found")
            require(recipient.isActive && recipient.deletedAt == null) {
                "Recipient account is not active"
            }
            val offeredInstances =
                request.offeredPrizeInstanceIds.map { id ->
                    validateHoldingAndOwned(id, initiatorId, "offered")
                }
            val requestedInstances =
                request.requestedPrizeInstanceIds.map { id ->
                    validateHoldingAndOwned(id, recipientId, "requested")
                }
            val now = Clock.System.now()
            val exchangeRequest =
                ExchangeRequest(
                    id = UUID.randomUUID(),
                    initiatorId = initiatorId,
                    recipientId = recipientId,
                    parentRequestId = null,
                    status = ExchangeRequestStatus.PENDING,
                    message = request.message,
                    respondedAt = null,
                    completedAt = null,
                    cancelledAt = null,
                    createdAt = now,
                    updatedAt = now,
                )
            val saved = exchangeRepository.save(exchangeRequest)
            val items =
                buildItems(saved.id, request.offeredPrizeInstanceIds, ExchangeItemSide.INITIATOR) +
                    buildItems(saved.id, request.requestedPrizeInstanceIds, ExchangeItemSide.RECIPIENT)
            exchangeRepository.saveItems(items)
            offeredInstances.forEach { instance ->
                prizeRepository.updateInstanceState(instance.id, PrizeState.EXCHANGING, PrizeState.HOLDING)
            }
            recordAuditAndOutbox(initiatorId, saved, outboxRepository, auditRepository, now)
            val initiator = playerRepository.findById(initiatorId)!!
            val allInstances = (offeredInstances + requestedInstances).associateBy { it.id.value.toString() }
            val allDefinitions =
                allInstances.values
                    .map { it.prizeDefinitionId }
                    .toSet()
                    .mapNotNull { defId -> prizeRepository.findDefinitionById(defId) }
                    .associateBy { it.id.value.toString() }
            saved.toDto(initiator, recipient, items, allInstances, allDefinitions)
        }
    }

    private suspend fun validateHoldingAndOwned(
        instanceIdStr: String,
        ownerId: PlayerId,
        role: String,
    ) = run {
        val instanceId = PrizeInstanceId(UUID.fromString(instanceIdStr))
        val instance =
            prizeRepository.findInstanceById(instanceId)
                ?: throw PrizeNotAvailableForExchangeException("$role prize $instanceIdStr not found")
        if (instance.ownerId != ownerId) {
            throw PrizeNotAvailableForExchangeException("$role prize $instanceIdStr not owned by expected player")
        }
        if (instance.state != PrizeState.HOLDING) {
            throw PrizeNotAvailableForExchangeException(
                "$role prize $instanceIdStr must be HOLDING, current: ${instance.state}",
            )
        }
        instance
    }

    private fun buildItems(
        requestId: UUID,
        ids: List<String>,
        side: ExchangeItemSide,
    ) = ids.map { id ->
        val now = Clock.System.now()
        ExchangeRequestItem(
            id = UUID.randomUUID(),
            exchangeRequestId = requestId,
            prizeInstanceId = PrizeInstanceId(UUID.fromString(id)),
            side = side,
            createdAt = now,
        )
    }
}

private fun recordAuditAndOutbox(
    initiatorId: PlayerId,
    saved: ExchangeRequest,
    outboxRepository: IOutboxRepository,
    auditRepository: IAuditRepository,
    now: kotlinx.datetime.Instant,
) {
    val metadata =
        buildJsonObject {
            put("exchangeRequestId", saved.id.toString())
            put("recipientId", saved.recipientId.value.toString())
        }
    auditRepository.record(
        AuditLog(
            id = UUID.randomUUID(),
            actorType = AuditActorType.PLAYER,
            actorPlayerId = initiatorId,
            actorStaffId = null,
            action = "exchange.request.created",
            entityType = "ExchangeRequest",
            entityId = saved.id,
            beforeValue = null,
            afterValue = null,
            metadata = metadata,
            createdAt = now,
        ),
    )
    outboxRepository.enqueue(ExchangeCreatedEvent(saved.id, saved.recipientId.value))
}

internal class ExchangeCreatedEvent(
    val requestId: UUID,
    val recipientId: UUID,
) : com.prizedraw.application.ports.output.DomainEvent {
    override val eventType: String = "exchange.request.created"
    override val aggregateType: String = "ExchangeRequest"
    override val aggregateId: UUID = requestId
}
