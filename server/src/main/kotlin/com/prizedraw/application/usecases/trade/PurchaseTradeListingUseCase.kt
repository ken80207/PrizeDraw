package com.prizedraw.application.usecases.trade

import com.prizedraw.api.mappers.toDto
import com.prizedraw.application.ports.input.trade.IPurchaseTradeListingUseCase
import com.prizedraw.application.ports.output.IDrawPointTransactionRepository
import com.prizedraw.application.ports.output.IOutboxRepository
import com.prizedraw.application.ports.output.IPlayerRepository
import com.prizedraw.application.ports.output.IPrizeRepository
import com.prizedraw.application.ports.output.IRevenuePointTransactionRepository
import com.prizedraw.application.ports.output.ITradeRepository
import com.prizedraw.application.services.LevelService
import com.prizedraw.contracts.dto.trade.TradeListingDto
import com.prizedraw.contracts.enums.DrawPointTxType
import com.prizedraw.contracts.enums.PrizeState
import com.prizedraw.contracts.enums.RevenuePointTxType
import com.prizedraw.contracts.enums.TradeOrderStatus
import com.prizedraw.domain.entities.DrawPointTransaction
import com.prizedraw.domain.entities.RevenuePointTransaction
import com.prizedraw.domain.entities.XpRules
import com.prizedraw.domain.entities.XpSourceType
import com.prizedraw.domain.valueobjects.PlayerId
import com.prizedraw.infrastructure.external.redis.DistributedLock
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import org.jetbrains.exposed.sql.transactions.experimental.newSuspendedTransaction
import org.slf4j.LoggerFactory
import java.util.UUID

/** Maximum optimistic lock retries for balance operations. */
private const val MAX_BALANCE_RETRIES = 3

/**
 * Executes a fully atomic trade purchase.
 *
 * Transaction steps:
 * 1. Validate buyer != seller; validate listing is LISTED.
 * 2. Acquire distributed lock on `trade:{listingId}`.
 * 3. In one DB transaction:
 *    a. Debit buyer `draw_points_balance` with optimistic lock retry.
 *    b. Compute fee_amount and seller_proceeds.
 *    c. Credit seller `revenue_points_balance`.
 *    d. Insert [DrawPointTransaction] (TRADE_PURCHASE_DEBIT) for buyer.
 *    e. Insert [RevenuePointTransaction] (TRADE_SALE_CREDIT) for seller.
 *    f. Transfer [PrizeInstance] ownership to buyer (HOLDING, TRADE_PURCHASE).
 *    g. Update [TradeListing] to COMPLETED with buyer_id, fee amounts, completed_at.
 *    h. Enqueue [TradeCompletedEvent] outbox event.
 */
public class PurchaseTradeListingUseCase(
    private val tradeRepository: ITradeRepository,
    private val playerRepository: IPlayerRepository,
    private val prizeRepository: IPrizeRepository,
    private val drawPointTxRepository: IDrawPointTransactionRepository,
    private val revenuePointTxRepository: IRevenuePointTransactionRepository,
    private val outboxRepository: IOutboxRepository,
    private val distributedLock: DistributedLock,
    private val levelService: LevelService? = null,
) : IPurchaseTradeListingUseCase {
    private val log = LoggerFactory.getLogger(PurchaseTradeListingUseCase::class.java)

    override suspend fun execute(
        buyerId: PlayerId,
        listingId: UUID,
    ): TradeListingDto {
        val listing =
            tradeRepository.findById(listingId)
                ?: throw TradeListingNotFoundException("Listing $listingId not found")
        if (listing.sellerId == buyerId) {
            throw SelfPurchaseException("Player ${buyerId.value} cannot purchase their own listing")
        }
        if (listing.status != TradeOrderStatus.LISTED) {
            throw ListingNotAvailableException("Listing $listingId is not available: ${listing.status}")
        }
        val result =
            distributedLock.withLock("trade:$listingId", ttlSeconds = 30) {
                executeAtomicPurchase(buyerId, listingId)
            } ?: throw ListingNotAvailableException("Listing $listingId is being processed, try again")
        awardTradeXp(buyerId, listing.listPrice, listingId)
        return result
    }

    @Suppress("LongMethod")
    private suspend fun executeAtomicPurchase(
        buyerId: PlayerId,
        listingId: UUID,
    ): TradeListingDto =
        newSuspendedTransaction {
            val listing = tradeRepository.findById(listingId)!!
            if (listing.status != TradeOrderStatus.LISTED) {
                throw ListingNotAvailableException("Listing $listingId is not available: ${listing.status}")
            }
            val now = Clock.System.now()
            val feeAmount = computeFeeAmount(listing.listPrice, listing.feeRateBps)
            val sellerProceeds = listing.listPrice - feeAmount
            debitBuyerWithRetry(buyerId, listing.listPrice, listingId, now)
            creditSeller(listing.sellerId, sellerProceeds, listingId, now)
            transferPrize(listing.prizeInstanceId.value, buyerId)
            val completed =
                tradeRepository.save(
                    listing.copy(
                        buyerId = buyerId,
                        feeAmount = feeAmount,
                        sellerProceeds = sellerProceeds,
                        status = TradeOrderStatus.COMPLETED,
                        completedAt = now,
                        updatedAt = now,
                    ),
                )
            outboxRepository.enqueue(TradeCompletedEvent(listingId, listing.sellerId.value, buyerId.value))
            val seller = playerRepository.findById(listing.sellerId)!!
            val instance = prizeRepository.findInstanceById(listing.prizeInstanceId)!!
            val definition = prizeRepository.findDefinitionById(instance.prizeDefinitionId)!!
            completed.toDto(seller, definition)
        }

    private suspend fun debitBuyerWithRetry(
        buyerId: PlayerId,
        amount: Int,
        listingId: UUID,
        now: Instant,
    ) {
        repeat(MAX_BALANCE_RETRIES) { attempt ->
            val buyer = playerRepository.findById(buyerId)!!
            if (buyer.drawPointsBalance < amount) {
                throw InsufficientDrawPointsException(amount, buyer.drawPointsBalance)
            }
            val updated = playerRepository.updateBalance(buyerId, -amount, 0, buyer.version)
            if (updated) {
                drawPointTxRepository.record(
                    DrawPointTransaction(
                        id = UUID.randomUUID(),
                        playerId = buyerId,
                        type = DrawPointTxType.TRADE_PURCHASE_DEBIT,
                        amount = -amount,
                        balanceAfter = buyer.drawPointsBalance - amount,
                        paymentOrderId = null,
                        description = "Trade purchase: listing $listingId",
                        createdAt = now,
                    ),
                )
                return
            }
            log.warn("Buyer balance lock failed for ${buyerId.value}, attempt ${attempt + 1}")
        }
        error("Failed to debit buyer ${buyerId.value} after $MAX_BALANCE_RETRIES attempts")
    }

    private suspend fun creditSeller(
        sellerId: PlayerId,
        proceeds: Int,
        listingId: UUID,
        now: Instant,
    ) {
        repeat(MAX_BALANCE_RETRIES) { attempt ->
            val seller = playerRepository.findById(sellerId)!!
            val updated = playerRepository.updateBalance(sellerId, 0, proceeds, seller.version)
            if (updated) {
                revenuePointTxRepository.record(
                    RevenuePointTransaction(
                        id = UUID.randomUUID(),
                        playerId = sellerId,
                        type = RevenuePointTxType.TRADE_SALE_CREDIT,
                        amount = proceeds,
                        balanceAfter = seller.revenuePointsBalance + proceeds,
                        tradeOrderId = listingId,
                        description = "Trade sale proceeds: listing $listingId",
                        createdAt = now,
                    ),
                )
                return
            }
            log.warn("Seller balance lock failed for ${sellerId.value}, attempt ${attempt + 1}")
        }
        error("Failed to credit seller ${sellerId.value} after $MAX_BALANCE_RETRIES attempts")
    }

    private suspend fun transferPrize(
        instanceIdRaw: UUID,
        newOwnerId: PlayerId,
    ) {
        val instanceId =
            com.prizedraw.domain.valueobjects
                .PrizeInstanceId(instanceIdRaw)
        prizeRepository.transferOwnership(instanceId, newOwnerId, PrizeState.HOLDING)
    }

    private suspend fun awardTradeXp(
        buyerId: PlayerId,
        listPrice: Int,
        listingId: UUID,
    ) {
        val levelService = levelService ?: return
        val xpAmount = (listPrice * XpRules.TRADE_PURCHASE_XP_RATE).toInt()
        if (xpAmount <= 0) {
            return
        }
        runCatching {
            levelService.awardXp(
                playerId = buyerId,
                amount = xpAmount,
                sourceType = XpSourceType.TRADE_PURCHASE,
                sourceId = listingId,
                description = "交易購買: listing $listingId",
            )
        }.onFailure { ex ->
            log.warn("Failed to award XP for trade purchase by ${buyerId.value}: ${ex.message}")
        }
    }

    private fun computeFeeAmount(
        listPrice: Int,
        feeRateBps: Int,
    ): Int = Math.round(listPrice.toLong() * feeRateBps / BASIS_POINTS_DIVISOR.toFloat())

    private companion object {
        const val BASIS_POINTS_DIVISOR = 10_000
    }
}

internal class TradeCompletedEvent(
    val listingId: UUID,
    val sellerId: UUID,
    val buyerId: UUID,
) : com.prizedraw.application.ports.output.DomainEvent {
    override val eventType: String = "trade.completed"
    override val aggregateType: String = "TradeListing"
    override val aggregateId: UUID = listingId
}
